import path = require('path');
import cdk = require('@aws-cdk/core');
import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import { CfnCluster } from '@aws-cdk/aws-msk';
import { Vpc } from '@aws-cdk/aws-ec2';

export interface MSKProps {
  readonly vpc: Vpc;
}

export class MSKCluster extends cdk.Construct {
  public readonly mskArn: string
  public readonly bootstrapServers: string

  constructor(scope: cdk.Construct, id: string, props: MSKProps) {
    super(scope, id);

    const cluster = new CfnCluster(this, 'mskCluster', {
      clusterName: 'AWSKafkaTutorialCluster',
      kafkaVersion:'2.3.1',
      encryptionInfo: {
        encryptionInTransit: {
          clientBroker: 'PLAINTEXT'
        }
      },
      openMonitoring: {
        prometheus: {
          jmxExporter: {
            enabledInBroker: true
          },
          nodeExporter: {
            enabledInBroker: true
          }
        }
      },
      enhancedMonitoring: 'PER_TOPIC_PER_BROKER',
      numberOfBrokerNodes: 3,
      brokerNodeGroupInfo: {
        clientSubnets: [
          props.vpc.publicSubnets[0].subnetId,
          props.vpc.publicSubnets[1].subnetId,
          props.vpc.publicSubnets[2].subnetId,
        ],
        brokerAzDistribution: 'DEFAULT',
        instanceType: 'kafka.m5.large',
        storageInfo: {
          ebsStorageInfo: {
            volumeSize: 200
          }
        }
      }
    });

    const func = new lambda.Function(this, 'MSKBootstrapFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/msk-bootstrap-handler')),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: {
        region: cdk.Stack.of(this).region,
      }
    });

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 'kafka:Describe*', 'kafka:Get*', 'kafka:List*' ],
      resources: [ '*' ]
    }));

    const customResource = new cfn.CustomResource(this, 'kafkaBootstrapServersLambda', { 
      provider: cfn.CustomResourceProvider.fromLambda(func),
      resourceType: "Custom::MSKBootstrapServers",
      properties: {
        MskArn: cluster.ref
      }    
    });

    new cdk.CfnOutput(this, 'KafkaResponse', { value: customResource.getAtt('BootstrapBrokers').toString() });
    this.bootstrapServers = customResource.getAtt('BootstrapBrokers').toString()
  }
}
