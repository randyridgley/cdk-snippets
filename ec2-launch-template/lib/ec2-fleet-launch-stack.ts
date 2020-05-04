import * as cdk from '@aws-cdk/core';
import { CfnInstanceProfile, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import ec2 = require("@aws-cdk/aws-ec2");
import events = require('@aws-cdk/aws-events');
import targets = require('@aws-cdk/aws-events-targets');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import fs = require('fs');

export class EC2FleetTemplateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const keyname = 'rridgley-default'
    const privateIpAddress = '10.0.0.20'
    
    // const vpcId = 'vpc-b323c6d4'
    // const vpc2 = ec2.Vpc.fromLookup(this, 'fleet-vpc', { vpcId });
    
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
    });

    const ec2SecurtyGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      description: "A Security Group that allows ingress access for HTTP access",
      vpc: vpc
    });
    ec2SecurtyGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "webserver access");
    ec2SecurtyGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "webserver ssl access");
    ec2SecurtyGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "ssh access");

    const ec2Role = new Role(this, "EC2Role", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')    
      ]
    });

    const instanceProfile = new CfnInstanceProfile(this, "InstanceProfile", {
      path: "/",
      roles: [
        ec2Role.roleName
      ]
    });

    const userData = fs.readFileSync("lib/userData.txt");

    const launchTemplate = new ec2.CfnLaunchTemplate(this, "LaunchTemplate", {
      launchTemplateData: {
        imageId: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }).getImage(this).imageId,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE2,
          ec2.InstanceSize.SMALL
        ).toString(),
        keyName: keyname,
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
            deviceIndex: 0,
            associatePublicIpAddress: true,
            groups: [
              ec2SecurtyGroup.securityGroupName,
              vpc.vpcDefaultSecurityGroup
            ],
            privateIpAddresses: [
              {
                privateIpAddress: privateIpAddress,
                primary: true
              }
            ],
            subnetId: vpc.publicSubnets[0].subnetId,
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
        iamInstanceProfile: {
          arn: `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:instance-profile/`+ instanceProfile.ref
        },
        monitoring: { enabled: true },
        userData: cdk.Fn.base64(userData.toString())
      }
    });

    const createEC2FleetLaunchOverride: (instanceType: string, subnetId: string, availabilityZone: string, priority: number) => ec2.CfnEC2Fleet.FleetLaunchTemplateOverridesRequestProperty = (instanceType: string, subnetId: string, availabilityZone: string, priority: number) => ({
      instanceType: instanceType,
      subnetId: subnetId,
      availabilityZone: availabilityZone,
      priority: priority
    });

    const ec2fleet = new ec2.CfnEC2Fleet(this, "EC2Fleet", {
      launchTemplateConfigs: [
        {
          launchTemplateSpecification: {
            launchTemplateId: launchTemplate.ref,
            version: launchTemplate.attrLatestVersionNumber
          },
          overrides: [
            createEC2FleetLaunchOverride('t3.small', vpc.publicSubnets[0].subnetId, vpc.publicSubnets[0].availabilityZone, 1),
            createEC2FleetLaunchOverride('t2.small', vpc.publicSubnets[0].subnetId, vpc.publicSubnets[0].availabilityZone, 2),
            createEC2FleetLaunchOverride('m5.large', vpc.publicSubnets[0].subnetId, vpc.publicSubnets[0].availabilityZone, 3)
          ]          
        }
      ],
      replaceUnhealthyInstances: true,
      excessCapacityTerminationPolicy: "termination", 
      terminateInstancesWithExpiration: true,
      tagSpecifications: [
        {
          resourceType: "fleet",
          tags: [
            {
              key: "Name",
              value: "TestFleet"
            }
          ]
        }
      ],
      type: 'maintain',
      targetCapacitySpecification: {
        totalTargetCapacity: 1,
        onDemandTargetCapacity: 1,
        spotTargetCapacity: 0,
        defaultTargetCapacityType: "on-demand"
      },
      spotOptions: {
        allocationStrategy: 'lowest-price',
        instanceInterruptionBehavior: 'stop'
      },
      onDemandOptions: {
        allocationStrategy: 'lowest-price',
        minTargetCapacity: 1
      }
    });

    const executionLambdaRole = new Role(this, 'lambdaRole', {
      roleName: 'helloLambdaExecutionRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    executionLambdaRole.attachInlinePolicy(new iam.Policy(this, 'LambdaFleetExecutionPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'ec2:ModifyFleet'
          ],
          resources: ['*'],
        })
      ]
    }));

    const lambdaFn = new lambda.Function(this, 'Singleton', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/lambda-handler.py', { encoding: 'utf-8' })),
      handler: 'index.main',
      timeout: cdk.Duration.seconds(300),
      runtime: lambda.Runtime.PYTHON_3_6,
      environment: {
        fleet_id: ec2fleet.ref
      },
      role: executionLambdaRole
    });

    const upRule = new events.Rule(this, 'UpRule', {
      schedule: events.Schedule.expression('cron(0 13 ? * MON-FRI *)')      
    });

    upRule.addTarget(new targets.LambdaFunction(lambdaFn, {
      event: events.RuleTargetInput.fromObject({target_capacity: 1})
    }));

    const downRule = new events.Rule(this, 'DownRule', {
      schedule: events.Schedule.expression('cron(0 21 ? * MON-FRI *)')      
    });

    downRule.addTarget(new targets.LambdaFunction(lambdaFn, {
      event: events.RuleTargetInput.fromObject({target_capacity: 0})
    }));
  }
}
