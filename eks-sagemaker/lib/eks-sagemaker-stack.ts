import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import { Vpc, SubnetType, InstanceType, SecurityGroup } from '@aws-cdk/aws-ec2';
import iam = require('@aws-cdk/aws-iam')
import cloud9 = require('@aws-cdk/aws-cloud9')

export class EksSagemakerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new Vpc(this, 'VPC', {
      maxAzs: 3,
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private-eks',
          subnetType: SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: 'public-alb-nat',
          subnetType: SubnetType.PUBLIC
        }
      ]
    });

    const clusterAdmin = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess' }
      ]
    });

    const instanceProfileClusterAdmin = new iam.CfnInstanceProfile(this, 'EKSClusterAdminInstanceProfile', {
      instanceProfileName: 'EKSClusterAdminInstanceProfile',
      roles: [
        clusterAdmin.roleName
      ]}
    )
    
    new cdk.CfnOutput(this, 'Cloud9AdminInstanceProfile', { value: instanceProfileClusterAdmin.ref });

    const eksCPSG = new SecurityGroup(this, 'eksCPSG', {
      vpc,
      description: 'Allow 443 access to eks masters',
      allowAllOutbound: true   // Can be set to false
    });

    const cluster = new eks.Cluster(this, 'eks-sagemaker', {
      clusterName: 'eks-sagemaker',
      defaultCapacity: 3,
      defaultCapacityInstance: new InstanceType('t3.medium'),
      vpc: vpc,
      vpcSubnets: [ { 
        onePerAz: true,
        subnetType: SubnetType.PRIVATE
      } ],
      outputClusterName: true,
      mastersRole: clusterAdmin,
      kubectlEnabled: true,
      securityGroup: eksCPSG
    });

    new cdk.CfnOutput(this, 'EKSCluster', { value: cluster.clusterEndpoint });

    const eksConsole = new cloud9.CfnEnvironmentEC2(this, 'eksConsole', {
      instanceType: 't2.small',
      description: 'eks management',
      name: 'eksConsole',
      // repositories: [
      //   {
      //     pathComponent: '/401kube',
      //     repositoryUrl: 'https://github.com/jyidiego/401kube.git'
      //   }
      // ],
      subnetId: vpc.selectSubnets( { onePerAz: true, subnetType: SubnetType.PUBLIC}).subnetIds[0],
      // ownerArn: 'arn:aws:iam::' + this.account + ':assumed-role/TeamRole/MasterKey'      
    });

    new cdk.CfnOutput(this, 'EKSConsole', { value: eksConsole.attrName });
  }
}
