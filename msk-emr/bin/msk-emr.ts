#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import { MSKCluster } from '../lib/msk-cluster';
import { KafkaConsole } from '../lib/kafka-console';
import { VpcNetwork } from '../lib/vpc-network';
import { EMRCluster } from '../lib/emr-cluster';
import { ECSKafkaUtilsCluster } from '../lib/ecs-kafka-utils';

export class MSKEMRStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly bootstrapServers: string;
  
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcNetwork = new VpcNetwork(this, 'VpcNetwork')
    this.vpc = vpcNetwork.vpc;

    const msk = new MSKCluster(this, 'MSK', {
      vpc: vpcNetwork.vpc
    });
    this.bootstrapServers = msk.bootstrapServers

    new KafkaConsole(this, 'kafkaConsole', {
      vpc: vpcNetwork.vpc
    });

    new EMRCluster(this, 'emrCluster', {
      keyName: 'default-east-2',
      vpc: vpcNetwork.vpc
    });
  }
}

export interface KafkaUtilProps extends cdk.StackProps {
  bootstrapServers: string,
  vpc: ec2.Vpc
}

export class KafkaUtilsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: KafkaUtilProps) {
    super(scope, id, props);

    new ECSKafkaUtilsCluster(this, 'ECSKafkaUtilsService', {
      vpc: props.vpc,
      mskBootstrapBrokers: props.bootstrapServers
    });
  }
}

const app = new cdk.App();
const mskEmr = new MSKEMRStack(app, 'MSKEMRProjStack', {
  env: {
    region: 'us-east-2', //process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  }
});

const kafkaUtilsStack = new KafkaUtilsStack(app, 'KafkaUtilsStack', {
  env: {
    region: 'us-east-2', //process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  bootstrapServers: mskEmr.bootstrapServers,
  vpc: mskEmr.vpc
}).addDependency(mskEmr)
