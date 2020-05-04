import cdk = require('@aws-cdk/core');
import cloud9 = require('@aws-cdk/aws-cloud9');
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';

export interface ConsoleProps {
  readonly vpc: Vpc;
}

export class KafkaConsole extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ConsoleProps) {
    super(scope, id);

    const kafkaConsole = new cloud9.CfnEnvironmentEC2(this, 'eksConsole', {
      instanceType: 't2.small',
      description: 'kafka management console',
      repositories: [
        {
          pathComponent: '/kafka',
          repositoryUrl: 'https://github.com/randyridgley/eks-cdk-kubeflow.git'
        }
      ],
      subnetId: props.vpc.selectSubnets( { onePerAz: true, subnetType: SubnetType.PUBLIC}).subnetIds[0],
    });

    new cdk.CfnOutput(this, 'KafkaConsole', { value: kafkaConsole.attrName });
  }
}