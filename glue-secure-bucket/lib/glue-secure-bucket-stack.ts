import * as cdk from '@aws-cdk/core';
import kms = require('@aws-cdk/aws-kms');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import lf = require('@aws-cdk/aws-lakeformation');
import athena = require('@aws-cdk/aws-athena');

import { AutoDeleteBucket } from '@mobileposse/auto-delete-bucket'

// Notes: userServiceLinkedRole:true on lf permissions overrides the role you supply. When encrypting results the user and not the service role need access to the kms key.
export class GlueSecureBucketStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dataLakeRole = new iam.Role(this, 'GlueSecureRole', {
      roleName: 'AWSGlueServiceRole-secure', // does this really need to start with AWSGlueServiceRole to be used with iam:PassRole https://docs.aws.amazon.com/glue/latest/dg/create-an-iam-role.html
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ]
    });

    dataLakeRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess'
      ],
      resources: ['*']
    }));

    const encryptionKey = new kms.Key(this, 'KmsKey', {
      alias: 'glue-s3-kms-key',
      description: 'KMS key for Glue and S3',
      enabled: true,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const dataLakeBucket = new AutoDeleteBucket(this, 'DataLakeBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'logs/dl/',
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365)
            }
          ]
        }
      ]
    });

    dataLakeBucket.grantReadWrite(dataLakeRole)

    const rawBucket = new AutoDeleteBucket(this, "RawDataLakeBucket", {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'logs/raw/'
    });

    rawBucket.grantReadWrite(dataLakeRole);

    // LakeFormation Resource registration and permissions
    const dlResource = new lf.CfnResource(this, 'dataLakeBucketLakeFormationResource', {
      resourceArn: dataLakeBucket.bucketArn,
      roleArn: dataLakeRole.roleArn,
      useServiceLinkedRole: false
    });

    const dlPermission = new lf.CfnPermissions(this, 'DataLakeLocationPermission', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeRole.roleArn,
      },
      resource: {
        dataLocationResource: {
          s3Resource: dataLakeBucket.bucketArn
        }
      },
      permissions: [
        'DATA_LOCATION_ACCESS'
      ]
    });
    dlPermission.node.addDependency(dlResource)

    const rawResource = new lf.CfnResource(this, 'rawBucketLakeFormationResource', {
      resourceArn: rawBucket.bucketArn,
      roleArn: dataLakeRole.roleArn,
      useServiceLinkedRole: false
    });

    const rawPermission = new lf.CfnPermissions(this, 'RawLocationPermission', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeRole.roleArn,
      },
      resource: {
        dataLocationResource: {
          s3Resource: rawBucket.bucketArn
        }
      },
      permissions: [
        'DATA_LOCATION_ACCESS'
      ]
    });
    rawPermission.node.addDependency(rawResource)

    dataLakeBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        's3:Get*',
        's3:Put*',
        's3:List*'
      ],
      resources: [
        dataLakeBucket.arnForObjects("*"),
        dataLakeBucket.bucketArn
      ],
      principals: [
        dataLakeRole.grantPrincipal
      ]
    }));

    dataLakeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [dataLakeBucket.arnForObjects('*')],
        conditions: {
          'StringNotEquals': {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      })
    );

    dataLakeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [dataLakeBucket.arnForObjects('*')],
        conditions: {
          'Null': {
            "s3:x-amz-server-side-encryption": true
          }
        }
      })
    );

    rawBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        's3:Get*',
        's3:Put*',
        's3:List*'
      ],
      resources: [
        rawBucket.arnForObjects("*"),
        rawBucket.bucketArn
      ],
      principals: [
        dataLakeRole.grantPrincipal
      ]
    }));

    new s3deploy.BucketDeployment(this, 'DeployGlueScripts', {
      sources: [s3deploy.Source.asset('./scripts')],
      destinationBucket: rawBucket,
      destinationKeyPrefix: 'scripts',
      retainOnDelete: false,
      serverSideEncryption: s3deploy.ServerSideEncryption.AWS_KMS,
      serverSideEncryptionAwsKmsKeyId: encryptionKey.keyId
    });

    new s3deploy.BucketDeployment(this, 'DeployGlueRawData', {
      sources: [s3deploy.Source.asset('./data')],
      destinationBucket: rawBucket,
      destinationKeyPrefix: 'data',
      retainOnDelete: false,
      serverSideEncryption: s3deploy.ServerSideEncryption.AWS_KMS,
      serverSideEncryptionAwsKmsKeyId: encryptionKey.keyId
    });

    // Glue Resources for Security Configuration, Database, Raw Crawler, and Job 
    const glueSecurityConf = new glue.CfnSecurityConfiguration(this, 'GlueSecurityConfiguration', {
      encryptionConfiguration: {
        s3Encryptions: [
          {
            kmsKeyArn: encryptionKey.keyArn,
            s3EncryptionMode: 'SSE-KMS'
          }
        ]
      },
      name: 'S3BucketSecurityConfiguration'
    })

    const glueDatabase = new glue.Database(this, 'SecureGlueDatabase', {
      databaseName: 'secure_db'
    });

    new glue.CfnJob(this, 'AWSWriteSecureParquet', {
      role: dataLakeRole.roleName,
      command: {
        name: "glueetl",
        scriptLocation: 's3://' + rawBucket.bucketName + '/scripts/write-to-secure-s3.py',
        pythonVersion: "3"
      },
      glueVersion: "1.0",
      name: 'WriteToS3SecureBucket',
      description: 'Write parquet schema to secure bucket',
      defaultArguments: {        
        '--GLUE_DATABASE': glueDatabase.databaseName,
        '--GLUE_TABLE_NAME': 'r_sensors',
        '--S3_OUTPUT_BUCKET': dataLakeBucket.bucketName,
        '--REGION': this.region,
        '--TempDir': 's3://' + rawBucket.bucketName + '/temp',
        // '--enable-metrics': '',
        // '--job-bookmark-option': 'job-bookmark-disable',
        // '--enable-continuous-cloudwatch-log': ''
      },
      maxRetries: 0,
      maxCapacity: 10.0,
      executionProperty: {
        maxConcurrentRuns: 1
      },
      securityConfiguration: glueSecurityConf.ref     
    });

    const sensorTable = new glue.CfnTable(this, 'SensorTable', {
      databaseName: glueDatabase.databaseName,
      catalogId: cdk.Aws.ACCOUNT_ID,
      tableInput: {
        name: "r_sensors",
        description: "Raw Sensor Data",
        parameters: {
            has_encrypted_data: false,
            classification: "json", 
            typeOfData: "file",
            'projection.enabled': true,
            'projection.year.type': 'integer',
            'projection.year.range': '2017,2020',
            'projection.month.type': 'integer',
            'projection.month.range': '1,12',
            'projection.day.type': 'integer',
            'projection.day.range': '1,31',
            'projection.hour.type': 'integer',
            'projection.hour.range': '0,23',
            'storage.location.template': 's3://'+ rawBucket.bucketName + '/data/sensors/year=${year}/month=${month}/day=${day}/hour=${hour}'
        },        
        storageDescriptor: {
            columns: [
              {
                name: "datetime",
                type: "string"
              },
              {
                name: "sensorid",
                type: "int"
              },
              {
                name: "temp",
                type: "int"
              },
              {
                name: "battery",
                type: "string"
              }
            ],
            compressed: false,
            inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            location: 's3://' + rawBucket.bucketName + '/data/sensors/',
            outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            serdeInfo: {
            serializationLibrary: "org.openx.data.jsonserde.JsonSerDe", 
            parameters: {
                paths: "battery,datetime,sensorid,temp"
            }
          },
          storedAsSubDirectories: false
        },
        partitionKeys: [
          {
            name: "year",
            type: "int"
          },
          {
            name: "month",
            type: "int"
          },
          {
            name: "day",
            type: "int"
          },
          {
            name: "hour",
            type: "int"
          }
        ],
        tableType: "EXTERNAL_TABLE"
      }
    });

    sensorTable.node.addDependency(encryptionKey);

    // Job LakeFormation permission to allow access to create table under secure_db
    const dbPermission = new lf.CfnPermissions(this, 'SecureDBPermission', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeRole.roleArn,
      },
      resource: {
        databaseResource: {
          name: glueDatabase.databaseName
        }
      },
      permissions: [
        'ALTER',
        'CREATE_TABLE',
        'DROP'
      ]
    });

    dbPermission.node.addDependency(glueDatabase);

    const tablePermission = new lf.CfnPermissions(this, 'SensorTablePermissions', {
      dataLakePrincipal: {
          dataLakePrincipalIdentifier: dataLakeRole.roleArn
      },
      resource: {
          tableResource: {
              databaseName: glueDatabase.databaseName,
              name: 'r_sensors',
          }
      },
      permissions: [
          'ALTER',
          'DROP',
          'DELETE',
          'INSERT',
          'SELECT'
      ]
    });

    tablePermission.node.addDependency(sensorTable)

    const secureWorkgroup = new athena.CfnWorkGroup(this, 'SecureWorkgroup', {
      name: 'DataLakeSecureWorkgroup',      
      workGroupConfiguration: {       
        publishCloudWatchMetricsEnabled: true, 
        enforceWorkGroupConfiguration: true,
        requesterPaysEnabled: false,
        resultConfiguration: {
          outputLocation: 's3://' + rawBucket.bucketName + '/results/',
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: encryptionKey.keyId
          }
        }
      }
    });

    new cdk.CfnOutput(this, 'DataLakeBucketArn', {
      value: dataLakeBucket.bucketArn,
    });

    new cdk.CfnOutput(this, 'RawBucketArn', {
      value: rawBucket.bucketArn,
    });

    new cdk.CfnOutput(this, 'KMSKeyArn', {
      value: encryptionKey.keyArn,
    });

    new cdk.CfnOutput(this, 'DataLakeRoleArn', {
      value: dataLakeRole.roleArn,
    });
  }
}
