import * as cdk from '@aws-cdk/core';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as logs from '@aws-cdk/aws-logs';

export class RdsReadReplicaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'Public Subnet 1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'Public Subnet 2',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'Private Subnet 1',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24
        },
        {
          name: 'Private Subnet 2',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24
        }
      ]
    })

    const database = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.MARIADB,
      instanceClass: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MEDIUM),
      multiAz: true,
      storageType: rds.StorageType.IO1,
      masterUsername: 'admin',
      vpc,
      databaseName: 'sales',
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      monitoringInterval: cdk.Duration.minutes(1),
      enablePerformanceInsights: true,
      cloudwatchLogsExports: [
        'audit'
      ],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      autoMinorVersionUpgrade: false,
    });

    new rds.DatabaseInstanceReadReplica(this, 'ReadReplica', {
      sourceDatabaseInstance: database,
      engine: rds.DatabaseInstanceEngine.MARIADB,
      instanceClass: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.LARGE),
      vpc
    });
  }
}
