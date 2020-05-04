import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2')
import * as logs from '@aws-cdk/aws-logs'
import * as iam from '@aws-cdk/aws-iam'

export class VpcNetwork extends cdk.Construct {
  vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'vpc', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 2,
      subnetConfiguration: [
        {
          name: 'Public Subnet 1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'Public Subnet 2',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'Private Subnet 1',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24
        },
        {
          name: 'Private Subnet 2',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24
        }
      ]
    })

    this.vpc.node.applyAspect(new cdk.Tag('Owner', 'rridgley'));
    this.vpc.node.applyAspect(new cdk.Tag('Environment', 'dev'));

    this.vpc.publicSubnets.forEach((subnet) => {
        subnet.node.applyAspect(new cdk.Tag('Name', 'public_'+subnet, { includeResourceTypes: ['AWS::EC2::Subnet'] }));
    });

    this.vpc.privateSubnets.forEach((subnet) => {
        subnet.node.applyAspect(new cdk.Tag('Name', 'private_'+subnet, { includeResourceTypes: ['AWS::EC2::Subnet'] }));
    });
    
    const logGroup = new logs.LogGroup(this, 'sample-vpc-logs');

    const role = new iam.Role(this, 'VPCFlowLogsRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com')
    });
    
    new ec2.FlowLog(this, 'FlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup, role),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    const s3vpce = new ec2.GatewayVpcEndpoint(this, 's3-vpce', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc: this.vpc
    });

    const cwmvpce = new ec2.InterfaceVpcEndpoint(this, 'cloudwatch', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH,
      vpc: this.vpc
    })

    const cwevpce = new ec2.InterfaceVpcEndpoint(this, 'cloudwatchevents', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS,
      vpc: this.vpc
    });

    const cwlvpce = new ec2.InterfaceVpcEndpoint(this, 'cloudwatchlogs', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      vpc: this.vpc
    })

    const kinesisvpce = new ec2.InterfaceVpcEndpoint(this, 'kinesis', {
      service: ec2.InterfaceVpcEndpointAwsService.KINESIS_STREAMS,
      vpc: this.vpc
    })
  }
}