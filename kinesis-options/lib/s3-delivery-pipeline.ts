import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import kds = require('@aws-cdk/aws-kinesis')
import kdf = require('@aws-cdk/aws-kinesisfirehose')
import logs = require('@aws-cdk/aws-logs');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue')

import { RemovalPolicy } from '@aws-cdk/core';
import { RetentionDays } from '@aws-cdk/aws-logs';

export interface DeliveryPipelineProps {
  bucket: s3.Bucket,
  stream: kds.Stream,
  database: glue.Database,
  tableName: string,
  curatedColumns: Array<glue.CfnTable.ColumnProperty>
  rawColumns: Array<glue.CfnTable.ColumnProperty>
}

export class S3DeliveryPipeline extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: DeliveryPipelineProps) {
    super(scope, id);

    const table = new glue.CfnTable(this, 'p_' + props.tableName, {
      databaseName: props.database.databaseName,
      catalogId: cdk.Aws.ACCOUNT_ID,
      tableInput: {
        description: 'processed ' + props.tableName,
        name: 'p_' + props.tableName,
        parameters: {
          has_encrypted_data: false,
          classification: "parquet", 
          typeOfData: "file"
        },
        storageDescriptor: { 
          columns: props.curatedColumns,
          compressed: false,
          inputFormat: "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
          location: 's3://' + props.bucket.bucketName + '/' + props.tableName + '/parq/',
          outputFormat: "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
          serdeInfo: {
            parameters: {
              paths: "active,admin2,combined_key,confirmed,country_region,deaths,fips,last_update,latitude,longitude,province_state,recovered"
            },
            serializationLibrary: "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
          },
          storedAsSubDirectories: false
        },
        tableType: "EXTERNAL_TABLE"
      }      
    });

    const cols = props.rawColumns.filter(col => col.name).join(',')

    const rawTable = new glue.CfnTable(this, 'o_' + props.tableName, {
      databaseName: props.database.databaseName,
      catalogId: cdk.Aws.ACCOUNT_ID,
      tableInput: {
        description: 'raw ' + props.tableName,
        name: 'o_' + props.tableName,
        parameters: {
          has_encrypted_data: false,
          classification: "json", 
          typeOfData: "file"
        },
        storageDescriptor: { 
          columns: props.rawColumns,
          compressed: false,
          inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          location: 's3://' + props.bucket.bucketName + '/' + props.tableName + '/raw/',
          outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          serdeInfo: {
            parameters: {
              paths: cols
            },
            serializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          },
          storedAsSubDirectories: false
        },
        tableType: "EXTERNAL_TABLE"
      } 
    });

    const firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogGroup', {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const firehoseLogStream = new logs.LogStream(this, 'FirehoseLogStream', {
      logGroup: firehoseLogGroup,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const firehoseLogStreamArn = `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${firehoseLogGroup.logGroupName}:log-stream:${firehoseLogStream.logStreamName}`;

    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      inlinePolicies: {
        'GluePermissions' : new iam.PolicyDocument({
          statements : [
              new iam.PolicyStatement({
                  actions : [
                    "glue:GetTableVersions"
                  ],
                  resources : ["*"]
              })
          ]
        }),
        'CloudWatchPermissions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['cloudwatch:PutMetricData'],
              resources: ['*']
            })
          ]
        }),
        'LogsPermissions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['logs:DescribeLogStreams', 'logs:DescribeLogGroups'],
              resources: [
                firehoseLogGroup.logGroupArn,
                `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:*`
              ]        
            })
          ]
        }),
        'LogsPutPermissions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['logs:PutLogEvents'],
              resources: [firehoseLogStreamArn]
            })
          ]
        }),
        'KinesisPermissions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['kinesis:DescribeStream', 'kinesis:GetRecords', 'kinesis:GetShardIterator'],
              resources: [props.stream.streamArn]
            })
          ]
        }),
        'S3Permissions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions : [
                's3:AbortMultipartUpload',
                's3:GetBucketLocation',
                's3:GetObject',
                's3:ListBucket',
                's3:ListBucketMultipartUploads',
                's3:PutObject',
              ],
              resources : [
                  props.bucket.bucketArn,
                  props.bucket.bucketArn + '/*'
              ]
            })
          ]
        })
      }
    });

    const firehose = new kdf.CfnDeliveryStream(this, 'DataDeliveryStream', {
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: props.stream.streamArn,
        roleArn: firehoseRole.roleArn
      },
      extendedS3DestinationConfiguration: {
        bucketArn: props.bucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 128
        },
        compressionFormat: 'UNCOMPRESSED',
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: firehoseLogGroup.logGroupName,
          logStreamName: firehoseLogStream.logStreamName
        },
        s3BackupMode: 'Enabled',
        s3BackupConfiguration: {
          roleArn: firehoseRole.roleArn,
          bucketArn: props.bucket.bucketArn,
          prefix: props.tableName + '/parq/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
          errorOutputPrefix: props.tableName + '/failed/' + props.stream.streamName + '!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
          bufferingHints: {
            sizeInMBs: 128,
            intervalInSeconds: 60
          },
          compressionFormat: 'UNCOMPRESSED',
          encryptionConfiguration: {
            noEncryptionConfig: 'NoEncryption'
          },
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: firehoseLogGroup.logGroupName,
            logStreamName: firehoseLogStream.logStreamName + '_' + props.stream.streamName
          }
        },
        dataFormatConversionConfiguration: {
          schemaConfiguration: {
            roleArn: firehoseRole.roleArn,
            catalogId: cdk.Aws.ACCOUNT_ID,
            databaseName: props.database.databaseName,
            tableName: 'p_' + props.tableName,
            region: cdk.Aws.REGION,
            versionId: 'LATEST'
          },
          inputFormatConfiguration: {
            deserializer: {
              openXJsonSerDe: {}
            }
          },
          outputFormatConfiguration: {
            serializer: {
              parquetSerDe: {}
            }
          },
          enabled: true
        }
      }
    });

    new cdk.CfnOutput(this, 'CloudwatchLogsInsights', { value: `https://console.aws.amazon.com/cloudwatch/home#logs-insights:queryDetail=~(end~0~source~'${firehoseLogGroup.logGroupName}~start~-3600~timeType~'RELATIVE~unit~'seconds)` });
  }
}