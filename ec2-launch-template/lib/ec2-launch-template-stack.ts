import * as cdk from '@aws-cdk/core';
import {CfnInstanceProfile, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import ec2 = require("@aws-cdk/aws-ec2");
// import s3 = require("@aws-cdk/aws-s3");
// import aas = require('@aws-cdk/aws-applicationautoscaling')
import { CfnScheduledAction, CfnAutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import {readFileSync} from "fs";

export class EC2LaunchTemplateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: 'PUB-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        }
      ]
    })

    vpc.node.applyAspect(new cdk.Tag('Owner', 'rridgley'));
    vpc.node.applyAspect(new cdk.Tag('Environment', 'dev'));

    vpc.publicSubnets.forEach((subnet) => {
        subnet.node.applyAspect(new cdk.Tag('Name', 'public_'+subnet, { includeResourceTypes: ['AWS::EC2::Subnet'] }));
    });

    const ec2SecurtyGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      description: "A Security Group that allows ingress access for HTTP access",
      vpc: vpc
    });
    ec2SecurtyGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "webserver access");

    // Role
    const ec2Role = new Role(this, "EC2Role", {
        assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
        inlinePolicies: {
            EC2Policy: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [
                            "s3:GetObject"
                        ],
                        resources: [
                            `arn:aws:s3:::*/*`
                        ]
                    })
                ]
            })
        }
    });

    // InstanceProfile
    const instanceProfile = new CfnInstanceProfile(this, "InstanceProfile", {
        path: "/",
        roles: [
            ec2Role.roleName
        ]
    });

    // User Data
    const userData = readFileSync("./lib/userData.txt");

    const launchTemplate = new ec2.CfnLaunchTemplate(this, "LaunchTemplate", {
      launchTemplateData: {
        imageId: new ec2.AmazonLinuxImage().getImage(this).imageId,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE2,
          ec2.InstanceSize.MICRO
        ).toString(),
        keyName: 'rridgley-default',
        securityGroups: [
          ec2SecurtyGroup.securityGroupId
        ],
        tagSpecifications: [
          {
              resourceType: "instance",
              tags: [
                  {
                      key: "Name",
                      value: "TestInstance"
                  }
              ]
          }
        ],
        networkInterfaces: [
          {
              associatePublicIpAddress: true,
              deviceIndex: 0,
              groups: [
                  ec2SecurtyGroup.securityGroupName
              ],
              // privateIpAddresses: [
              //   {
              //     privateIpAddress: '10.0.0.20',
              //     primary: true
              //   }
              // ]
          }
        ],
        blockDeviceMappings: [
          {
              deviceName: "/dev/xvda",
              ebs: {
                  deleteOnTermination: true,
                  volumeType: "gp2",
                  volumeSize: 8
              }
          }
        ],
        monitoring: { enabled: true },
        userData: cdk.Fn.base64(userData.toString())
      }
    });

    const autoScalingName = 'FleetAutoScaling';

    const autoScalingGroup = new CfnAutoScalingGroup(this, 'ASG', {
      autoScalingGroupName: autoScalingName,
      maxSize: '1',
      minSize: '1',
      availabilityZones: [
        vpc.publicSubnets[0].availabilityZone
      ],
      desiredCapacity: '1',
      vpcZoneIdentifier: [
        vpc.publicSubnets[0].subnetId,
      ],
      targetGroupArns: [

      ],
      healthCheckType: 'EC2',
      healthCheckGracePeriod: 60,
      mixedInstancesPolicy: {        
        instancesDistribution: {
            onDemandBaseCapacity: 1,
            onDemandAllocationStrategy: "prioritized",
            spotAllocationStrategy: "lowest-price"            
        },
        launchTemplate: {
            launchTemplateSpecification: {
                launchTemplateName: launchTemplate.launchTemplateName,
                launchTemplateId: launchTemplate.ref,
                version: launchTemplate.attrLatestVersionNumber
            },
            overrides: [
                {
                  instanceType: "t3.small"                  
                },
                {
                  instanceType: "t2.small"
                },
                {
                  instanceType: "m5.large"
                },
            ]
        }
      },
    })

    const scalingUpPolicy = new CfnScheduledAction(this, 'FleetScaleUp', {
      autoScalingGroupName: autoScalingName,
      desiredCapacity: 1,
      minSize: 1,
      maxSize: 1,      
      recurrence: '0 13 * * 1-5'
    });
    scalingUpPolicy.addDependsOn(autoScalingGroup)

    const scalingDownPolicy = new CfnScheduledAction(this, 'FleetScaleDown', {
      autoScalingGroupName: autoScalingName,
      desiredCapacity: 1,
      minSize: 1,
      maxSize: 1,      
      recurrence: '* 21 * * 1-5'
    });
    scalingDownPolicy.addDependsOn(autoScalingGroup)

    // const fleetAutoScalingUp = new aas.ScalableTarget(this, 'FleetScheduleUp', {
    //   minCapacity: 1,
    //   maxCapacity: 1,
    //   resourceId: 'spot-fleet-request/' + ec2Fleet.ref,
    //   scalableDimension: 'ec2:spot-fleet-request:TargetCapacity',
    //   serviceNamespace: aas.ServiceNamespace.EC2
    // })

    // fleetAutoScalingUp.scaleOnSchedule('FleetScheduleUpScale', {
    //   schedule: aas.Schedule.expression('0 13 ? * MON-FRI *'),
    //   minCapacity: 1,
    //   maxCapacity: 1
    // });

    // const fleetAutoScalingDown = new aas.ScalableTarget(this, 'FleetScheduleDown', {
    //   minCapacity: 0,
    //   maxCapacity: 0,
    //   resourceId: 'spot-fleet-request/' + spotFleet.ref,
    //   scalableDimension: 'ec2:spot-fleet-request:TargetCapacity',
    //   serviceNamespace: aas.ServiceNamespace.EC2
    // })

    // fleetAutoScalingDown.scaleOnSchedule('FleetScheduleDownScale', {
    //   schedule: aas.Schedule.expression('0 21 ? * MON-FRI *'),
    //   minCapacity: 0,
    //   maxCapacity: 0
    // });
  }
}
