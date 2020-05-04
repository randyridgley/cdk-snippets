import cdk = require('@aws-cdk/core');
import {Vpc, SubnetType} from '@aws-cdk/aws-ec2';
import { Tag } from '@aws-cdk/core';



export class VpcNetwork extends cdk.Construct {
  vpc: Vpc

  constructor(scope: cdk.Construct, id: string) {
      super(scope, id);

      this.vpc = new Vpc(this, "VpcNetwork", {
        cidr: "10.0.0.0/16",
        maxAzs: 3,
        natGateways: 3,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'Private',
            subnetType: SubnetType.PRIVATE
          },
          {
            cidrMask: 24,
            name: 'Public',
            subnetType: SubnetType.PUBLIC
          }
        ]
      });

      this.vpc.node.applyAspect(new cdk.Tag('Owner', 'rridgley'));
      this.vpc.node.applyAspect(new cdk.Tag('Environment', 'dev'));

      this.vpc.publicSubnets.forEach((subnet) => {
        subnet.node.applyAspect(new Tag('Name', 'public_'+subnet, { includeResourceTypes: ['AWS::EC2::Subnet'] }));
      });

      this.vpc.privateSubnets.forEach((subnet) => {
        subnet.node.applyAspect(new Tag('Name', 'private_'+subnet, { includeResourceTypes: ['AWS::EC2::Subnet'] }));
      });
  
      new cdk.CfnOutput(this,"VpcNetworkId", {
        exportName: "VpcNetworkId",
        value: this.vpc.vpcId
      });
      
      // // control panel security group 
      // this.controlPlaneSG = new ec2.SecurityGroup(this, `EksControlPlaneSG`, {
      //   vpc: this.vpc
      // });

      // // work nodes security group
      // this.nodesSG = new ec2.SecurityGroup(this, "NodesSecurityGroup",{
      //   securityGroupName: "nodes-for-eks-sg",
      //   vpc: this.vpc
      // });
      // //control panel access to nodes
      // this.nodesSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
      // this.nodesSG.addIngressRule(this.controlPlaneSG, ec2.Port.tcpRange(1025,65535))
      // this.nodesSG.addIngressRule(this.controlPlaneSG, ec2.Port.tcp(443))

      // //access to control panel
      // this.controlPlaneSG.addIngressRule(this.nodesSG, ec2.Port.tcp(443))

      // this.nodesSharedSG = new ec2.SecurityGroup(this, "NodesSharedSecurityGroup",{
      //     securityGroupName: "nodes-shared-for-eks-sg",
      //     vpc: this.vpc
      // });

      // //work nodes shared security group
      // this.nodesSharedSG.addIngressRule(this.nodesSharedSG, ec2.Port.allTcp())

      // new cdk.CfnOutput(this,"ControlPlaneSGId", {
      //   exportName: "ControlPlaneSGId",
      //   value: this.controlPlaneSG.securityGroupId
      // });
      
      // new cdk.CfnOutput(this,"NodesSGId", {
      //   exportName: "NodesSGId",
      //   value: this.nodesSG.securityGroupId
      // });
      
      // new cdk.CfnOutput(this,"NodesSharedSGId", {
      //   exportName: "NodesSharedSGId",
      //   value: this.nodesSharedSG.securityGroupId
      // });
    }
}