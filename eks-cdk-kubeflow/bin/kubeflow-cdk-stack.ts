import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import s3 = require('@aws-cdk/aws-s3');
import ec2 = require('@aws-cdk/aws-ec2');
import lambda = require('@aws-cdk/aws-lambda');
import { AccountRootPrincipal, ManagedPolicy, Role } from '@aws-cdk/aws-iam';
import iam = require('@aws-cdk/aws-iam');
import { InstanceType, InstanceClass, InstanceSize } from '@aws-cdk/aws-ec2';

import { KubeflowCluster } from '../lib/kubeflow-cluster';
import { EKSConsole } from '../lib/eks-console';
import { VpcNetwork } from '../lib/vpc-network';

import moment = require('moment');
import path = require('path');

export class KubeflowStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly nodegroupRoleArn: string;
  public readonly clusterName: string;
  public readonly bucketName: string;
  public readonly clusterAdminRoleArn: string;
  public readonly clusterRoleArn: string;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcNetwork = new VpcNetwork(this, 'VpcNetwork')
    this.vpc = vpcNetwork.vpc
 
    // first define the role
    const clusterAdmin = new Role(this, 'AdminRole', {
      assumedBy: new AccountRootPrincipal()
    });
    clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'));
    clusterAdmin.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'));

    this.clusterAdminRoleArn = clusterAdmin.roleArn;

    new EKSConsole(this, 'eksConsole', {
      vpc: vpcNetwork.vpc
    });

    // The code that defines your stack goes here
    const cluster = new eks.Cluster(this, 'KubeflowCluster', {
      mastersRole: clusterAdmin,
      vpc: vpcNetwork.vpc,
      outputClusterName: true
    });

    this.clusterName = cluster.clusterName;
    this.clusterRoleArn = cluster.role.roleArn;

    // create a custom node group
    const ng = cluster.addCapacity('kubeflow-ng1', {
      instanceType: InstanceType.of(InstanceClass.M5, InstanceSize.LARGE),
      associatePublicIpAddress: false,
      bootstrapEnabled: true,
      desiredCapacity: 3,
      minCapacity: 3,
      maxCapacity: 6,
      mapRole: true
    });

    const nodegroupRole = new iam.Role(this, 'EKSNodeRole', {
      roleName: 'EKSNodeGroupInstanceRole',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy')
      ]
    });

    this.nodegroupRoleArn = nodegroupRole.roleArn;

    const iamAlbIngressPolicy = new iam.PolicyStatement({
      resources: ["*"],
      actions: [
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:GetCertificate",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CreateSecurityGroup",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeAddresses",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeTags",
        "ec2:DescribeVpcs",
        "ec2:ModifyInstanceAttribute",
        "ec2:ModifyNetworkInterfaceAttribute",
        "ec2:RevokeSecurityGroupIngress",        
        "elasticloadbalancing:AddListenerCertificates",
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:DeleteRule",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:DescribeListenerCertificates",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:DescribeSSLPolicies",
        "elasticloadbalancing:DescribeTags",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:ModifyListener",
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:ModifyRule",
        "elasticloadbalancing:ModifyTargetGroup",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:RemoveListenerCertificates",
        "elasticloadbalancing:RemoveTags",
        "elasticloadbalancing:SetIpAddressType",
        "elasticloadbalancing:SetSecurityGroups",
        "elasticloadbalancing:SetSubnets",
        "elasticloadbalancing:SetWebACL",
        "iam:CreateServiceLinkedRole",
        "iam:GetServerCertificate",
        "iam:ListServerCertificates",
        "cognito-idp:DescribeUserPoolClient",
        "waf-regional:GetWebACLForResource",
        "waf-regional:GetWebACL",
        "waf-regional:AssociateWebACL",
        "waf-regional:DisassociateWebACL",
        "tag:GetResources",
        "tag:TagResources",
        "waf:GetWebACL"
      ],
    });

    const alb = new iam.Policy(this, 'iam_alb_ingress_policy', { 
      policyName: "iam_alb_ingress_policy",
      statements: [iamAlbIngressPolicy],
    });

    nodegroupRole.attachInlinePolicy(alb)

    const fsxIamPolicy = new iam.PolicyStatement({
      resources: ["arn:aws:iam::*:role/aws-service-role/s3.data-source.lustre.fsx.amazonaws.com/*"],
      actions: [
        "iam:CreateServiceLinkedRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy"
      ]
    });

    const fsxPolicy = new iam.PolicyStatement({
      resources: ["*"],
      actions: [
        "fsx:*",
        "s3:*",
        "ec2:CreateNetworkInterface"
      ]
    });

    const fsxIam = new iam.Policy(this, 'iam_csi_fsx_policy', { 
      policyName: "iam_csi_fsx_policy",
      statements: [fsxIamPolicy, fsxPolicy],
    });

    nodegroupRole.attachInlinePolicy(fsxIam)

    const clusterBucket = new s3.Bucket(this, 'clusterBucket', {
      bucketName: this.makeBucketName("kubeflow-demo")
    });
    this.bucketName = clusterBucket.bucketName;

  }

  makeBucketName(bucketSuffix: string) : string {
    return cdk.Aws.ACCOUNT_ID + moment().format('YYYYMMDDhhmmss') + bucketSuffix;
  }
}

export interface ManagedNodesStackProps extends cdk.StackProps {
  clusterName: string;
  nodegroupRoleArn: string
  vpc: ec2.Vpc
}

export class KubeflowManagedNodesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ManagedNodesStackProps) {
    super(scope, id, props);
    const nodegroupName = 'ng-kubeflow'
        
    new cdk.CfnResource(this, 'ClusterNodeGroup', {
      type: 'AWS::EKS::Nodegroup',
      properties: {
        AmiType: 'AL2_x86_64',
        ClusterName: props.clusterName,
        DiskSize: 20,
        InstanceTypes: [
          "m5.large"
        ],
        Labels: {
          "alpha.eksctl.io/nodegroup-name": nodegroupName,
          "alpha.eksctl.io/cluster-name": props.clusterName
        },
        NodegroupName: nodegroupName,
        NodeRole: props.nodegroupRoleArn,
        ScalingConfig: {
          DesiredSize: 3,          
          MaxSize: 5,
          MinSize: 2
        },
        Subnets: [
          props.vpc.privateSubnets[0].subnetId,
          props.vpc.privateSubnets[1].subnetId
        ],
        Tags: {
          "alpha.eksctl.io/cluster-name": props.clusterName,
          "alpha.eksctl.io/nodegroup-name": nodegroupName,
          "alpha.eksctl.io/nodegroup-type": "managed"
        }
      }
    });
  }
}

export interface KubeflowStackProps extends cdk.StackProps {
  clusterName: string;
  clusterRoleArn: string;
  clusterAdminRoleArn: string;
  nodegroupRoleArn: string;
  bucketName: string
}

export class KubeflowInstallStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: KubeflowStackProps) {
    super(scope, id, props);

    const kfctlLayer = new lambda.LayerVersion(this,'KfctlLambdaLayer',{
      description: 'AWS Lambda Layer for the kfctl CLI',
      compatibleRuntimes: [lambda.Runtime.PROVIDED],
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/kfctl-layer/layer.zip')),
      license: 'Available under the MIT-0 license.',
      layerVersionName: 'lambda-layer-kfctl'
    });

    const kubectlLayer = new lambda.LayerVersion(this,'KubectlLambdaLayer',{
      description: 'AWS Lambda Layer for the kubectl CLI',
      compatibleRuntimes: [lambda.Runtime.PROVIDED],
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/kubectl-layer/layer.zip')),
      license: 'Available under the MIT-0 license.',
      layerVersionName: 'lambda-layer-kubectl'
    });

    new KubeflowCluster(this, 'KfCluster', {
      layers: [
        kfctlLayer,
        kubectlLayer
      ],
      configUrl: "https://raw.githubusercontent.com/kubeflow/manifests/v0.7-branch/kfdef/kfctl_aws.0.7.0.yaml",
      clusterName: props.clusterName,
      clusterRoleArn: props.clusterRoleArn,
      bucketName: props.bucketName,
      adminRoleArn: props.clusterAdminRoleArn,
      nodeRoleArn: props.nodegroupRoleArn
    });
  }
}
const app = new cdk.App();
const kube = new KubeflowStack(app, 'KubeflowStack');

const managedNodeStack = new KubeflowManagedNodesStack(app, "KubeflowManagedNodesStack", {
  clusterName: kube.clusterName,
  nodegroupRoleArn: kube.nodegroupRoleArn,
  vpc: kube.vpc
})
managedNodeStack.addDependency(kube)

const kubeflowInstallStack = new KubeflowInstallStack(app, 'KubeflowInstallStack', {
  bucketName: kube.bucketName,
  clusterAdminRoleArn: kube.clusterAdminRoleArn,
  clusterName: kube.clusterName,
  clusterRoleArn: kube.clusterRoleArn,
  nodegroupRoleArn: kube.nodegroupRoleArn
})

