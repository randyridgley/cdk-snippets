import * as cdk from '@aws-cdk/core';
import iam = require('@aws-cdk/aws-iam');
import logs = require('@aws-cdk/aws-logs');
import kinesis = require('@aws-cdk/aws-kinesis');
import lambda = require('@aws-cdk/aws-lambda');
import lambda_sources = require('@aws-cdk/aws-lambda-event-sources');
import ssm = require('@aws-cdk/aws-ssm');
import dynamodb = require('@aws-cdk/aws-dynamodb');

export interface KvsKitStackProps extends cdk.StackProps {
  appName: string;
  streamNames: string;
  tagFilters: string;
  sageMakerEndpoint: string;
  endPointAcceptContentType: string;
}

export class KvsKitStack extends cdk.Stack {
  public readonly ddbTable: dynamodb.Table;
  public readonly kds: kinesis.Stream;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: cdk.Construct, id: string, props: KvsKitStackProps) {
    super(scope, id, props);
    
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      logGroupName: props.appName
    });

    this.kds = new kinesis.Stream(this, "KvsDataStream", {
      shardCount: 3,
      retentionPeriod: cdk.Duration.hours(48)
    });

    this.ddbTable = new dynamodb.Table(this, 'DDBTable', {
      tableName: props.appName,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'leaseKey', type: dynamodb.AttributeType.STRING },            
    });

    const kitKdsLambda = new lambda.Function(this, 'KitKdsLambdaHandler', {
      runtime: lambda.Runtime.PYTHON_3_6,
      code: lambda.Code.asset('lib/kvs-kit-handler'), 
      handler: 'lambda.lambda_handler',
      timeout: cdk.Duration.seconds(60)    
    });

    kitKdsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "kinesis:DescribeStream",
        "kinesis:GetRecords",
        "kinesis:GetShardIterator",
        "kinesis:ListStreams"
      ],
      resources: [
        `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`,
        `arn:aws:kinesis:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stream/${this.kds.streamName}`
      ]
    }));

    kitKdsLambda.addEventSource(new lambda_sources.KinesisEventSource(this.kds, {
      batchSize: 1, // default
      startingPosition: lambda.StartingPosition.TRIM_HORIZON
    }));

    this.kds.grantRead(kitKdsLambda)

    new ssm.StringParameter(this, 'KitSSMParameter', {
      description: 'Configuration for SageMaker app',
      parameterName: props.appName,
      stringValue: `{"streamNames":[${props.streamNames}], "tagFilters":[${props.tagFilters}],"sageMakerEndpoint":"${props.sageMakerEndpoint}",
      "endPointAcceptContentType": "${props.endPointAcceptContentType}",
      "kdsStreamName":"${this.kds.streamName}","inferenceInterval":6,"sageMakerTaskQueueSize":5000,
      "sageMakerTaskThreadPoolSize":20,"sageMakerTaskTimeoutInMilli":20000,
      "sageMakerTaskThreadPoolName":"SageMakerThreadPool-%d"}`
    });    
  }
}