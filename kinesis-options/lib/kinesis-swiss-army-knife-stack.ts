import fs = require('fs')
import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import logs = require('@aws-cdk/aws-logs');
import kds = require('@aws-cdk/aws-kinesis');
import kda = require('@aws-cdk/aws-kinesisanalytics');
import glue = require('@aws-cdk/aws-glue');
import lambda = require('@aws-cdk/aws-lambda');
import dynamodb = require('@aws-cdk/aws-dynamodb');

import { RemovalPolicy, Duration } from '@aws-cdk/core';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { EmptyBucketOnDelete } from './empty-bucket';
import { S3DeliveryPipeline } from './s3-delivery-pipeline';
import { StreamDashboard } from './stream-dashboard';
import { VpcNetwork } from './vpc-network';
import { NeptuneNotebooks } from './neptune-notebook';
import { BuildArtifacts } from './build-artifacts';

export class KinesisSwissArmyKnifeStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    this.templateOptions.description = 'Creates a sample streaming ETL pipeline based on Apache Flink and Amazon Kinesis Data Analytics that reads data from a Kinesis data stream and persists it to Amazon S3 (shausma-kda-streaming-etl)';

    const bucket = new s3.Bucket(this, 'Bucket', {
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      metrics: [{
        id: 'EntireBucket',
      }],
      lifecycleRules: [{
        abortIncompleteMultipartUploadAfter: Duration.days(7)
      }]
    });

    const emptyBucket = new EmptyBucketOnDelete(this, 'EmptyBucket', {
      bucket: bucket
    });

    new cdk.CfnOutput(this, `OutputBucket`, { value: `https://console.aws.amazon.com/s3/buckets/${bucket.bucketName}/data-lake/` });

    const vpcNetwork = new VpcNetwork(this, 'VpcNetwork');

    const database = new glue.Database(this, 'RawEventsDatabase', {
      databaseName: 'events'
    });

    const stream = new kds.Stream(this, 'InputStream', {
      shardCount: 8
    });

    const outStream = new kds.Stream(this, 'OutputStream', {
      shardCount: 8
    });

    new S3DeliveryPipeline(this, 'RawDeliveryPipeline', {
      bucket: bucket,
      database: database,
      stream: stream,
      tableName: 'events',
      rawColumns: [{
        name: 'col',
        type: 'string'
      }],
      curatedColumns: [{
        name: 'col',
        type: 'string'
      }]
    });

    new S3DeliveryPipeline(this, 'CuratedDeliveryPipeline', {
      bucket: bucket,
      database: database,
      stream: outStream,
      tableName: 'region_events',
      rawColumns: [{
        name: 'col',      
        type: 'string',
        comment: 'default column'
      }],
      curatedColumns: [{
        name: 'col',
        type: 'string',
        comment: 'default column'
      }]
    });

    const lambdaSource = fs.readFileSync('lambda/stream-handler.py').toString();

    const streamLambda =  new lambda.Function(this, 'EmptyBucketLambda', {
        runtime: lambda.Runtime.PYTHON_3_7,
        timeout: Duration.seconds(15),
        code: lambda.Code.inline(lambdaSource),
        handler: 'index.handler'
    });

    const configTable = new dynamodb.Table(this, "ConfigTable", {
        partitionKey: {name: "id", type: dynamodb.AttributeType.STRING},
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });
    
    configTable.grantStreamRead(streamLambda);
    
    streamLambda.addEventSourceMapping("EventSourceMapping", {
        eventSourceArn: configTable.tableStreamArn as string,
        enabled: true,
        startingPosition: lambda.StartingPosition.LATEST
    })

    new NeptuneNotebooks(this, 'NeptuneNotebook', {
      vpc: vpcNetwork.vpc
    })

    const artifacts = new BuildArtifacts(this, 'BuildArtifacts', {
      bucket: bucket,
      flinkVersion: '1.8.2',
      scalaVersion: '2.11',
      flinkConsumerVersion: 'master'
    });

    const logGroup = new logs.LogGroup(this, 'KdaLogGroup', {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const logStream = new logs.LogStream(this, 'KdaLogStream', {
      logGroup: logGroup,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const logStreamArn = `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${logGroup.logGroupName}:log-stream:${logStream.logStreamName}`;

    const kdaRole = new iam.Role(this, 'KdaRole', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
    });

    bucket.grantReadWrite(kdaRole);
    stream.grantRead(kdaRole);

    kdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [ 'kinesis:ListShards'],
      resources: [ stream.streamArn ]
    }))

    kdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [ 'kinesis:PutRecord', 'kinesis:PutRecordBatch'],
      resources: [ outStream.streamArn ]
    }))

    kdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [ 'cloudwatch:PutMetricData' ],
      resources: [ '*' ]
    }));

    kdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [ 'logs:DescribeLogStreams', 'logs:DescribeLogGroups' ],
      resources: [
        logGroup.logGroupArn,
        `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:*`
      ]
    }));

    kdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [ 'logs:PutLogEvents' ],
      resources: [ logStreamArn ]
    }));

    const kdaApp = new kda.CfnApplicationV2(this, 'KdaApplication', {
      runtimeEnvironment: 'FLINK-1_8',
      serviceExecutionRole: kdaRole.roleArn,
      applicationName: `${cdk.Aws.STACK_NAME}`,
      applicationConfiguration: {
        environmentProperties: {
          propertyGroups: [
            {
              propertyGroupId: 'FlinkApplicationProperties',
              propertyMap: {
                OutputBucket: `s3://${bucket.bucketName}/streaming-etl-output/`,
                ParquetConversion: true,
                InputKinesisStream: stream.streamName
              },
            }
          ]
        },
        flinkApplicationConfiguration: {
          monitoringConfiguration: {
            logLevel: 'INFO',
            metricsLevel: 'TASK',
            configurationType: 'CUSTOM'
          },
          parallelismConfiguration: {
            autoScalingEnabled: false,
            parallelism: 2,
            parallelismPerKpu: 1,
            configurationType: 'CUSTOM'
          },
          checkpointConfiguration: {
            configurationType: "CUSTOM",
            checkpointInterval: 60_000,
            minPauseBetweenCheckpoints: 60_000,
            checkpointingEnabled: true
          }
        },
        applicationSnapshotConfiguration: {
          snapshotsEnabled: false
        },
        applicationCodeConfiguration: {
          codeContent: {
            s3ContentLocation: {
              bucketArn: bucket.bucketArn,
              fileKey: 'target/amazon-kinesis-analytics-streaming-etl-1.0-SNAPSHOT.jar'        
            }
          },
          codeContentType: 'ZIPFILE'
        }
      }
    });

    new kda.CfnApplicationCloudWatchLoggingOptionV2(this, 'KdsFlinkProducerLogging', {
        applicationName: kdaApp.ref.toString(),
        cloudWatchLoggingOption: {
          logStreamArn: logStreamArn
        }
    });

    kdaApp.addDependsOn(artifacts.consumerBuildSuccessWaitCondition);
    kdaApp.addDependsOn(emptyBucket.customResource);       //ensures that the app is stopped before the bucket is emptied

    new StreamDashboard(this, 'InputStreamDashboard', {
      stream: stream,
      bucket: bucket,
    });

    new StreamDashboard(this, 'OutputStreamDashboard', {
      stream: outStream,
      bucket: bucket
    });
  }
}