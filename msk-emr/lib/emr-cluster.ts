import cdk = require('@aws-cdk/core');
import iam = require('@aws-cdk/aws-iam');
import emr = require('@aws-cdk/aws-emr');
import ec2 = require('@aws-cdk/aws-ec2');
import { CfnStep } from '@aws-cdk/aws-emr';

export interface EMRProps {
  keyName: string,
  vpc: ec2.Vpc
}

export class EMRCluster extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: EMRProps) {
    super(scope, id);

    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc
    });

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    const role = new iam.Role(this, 'ReplayRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceforEC2Role')
      ]
    });

    const profile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
      roles: [
        role.roleName
      ]
    });
    
    const cluster = new emr.CfnCluster(this, 'EmrCluster', {
      name: 'SparkStreamingCluster',
      applications: [
        { name: 'Spark' },
        { name: 'Ganglia' },
        { name: 'Hive' },
        { name: 'Livy' }
      ],
      logUri: 's3://analytics-serverless-central/emr-logs/',
      instances: {
        masterInstanceGroup: {
          instanceCount: 1,
          instanceType: 'c5.xlarge',
          name: 'Master'
        },
        coreInstanceGroup: {
          instanceCount: 2,
          instanceType: 'r5.xlarge',
          name: 'Core'
        },
        ec2KeyName: props.keyName,
        additionalMasterSecurityGroups: [
          sg.securityGroupName
        ],
        ec2SubnetId: props.vpc.publicSubnets[0].subnetId
      },
      serviceRole: 'EMR_DefaultRole',
      releaseLabel: 'emr-5.29.0',
      visibleToAllUsers: true,
      jobFlowRole: profile.ref,
      configurations: [
        {
          classification: 'emrfs-site',
          configurationProperties: {
            "fs.s3.maxConnections": "1000"
          }
        },
        { 
          classification: 'hive-site',
          configurationProperties: {
            "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
          }
        },
        { 
          classification:"spark-hive-site", 
          configurationProperties: {
            "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
          }
        },
        {
          classification:"spark-defaults", 
          configurationProperties: {
            "spark.dynamicAllocation.enabled": "false",
            "spark.executor.cores": "2",
            "spark.executor.memory": "3g",
            "spark.executor.instances": "16"
          }
        },
        {
          classification:"core-site", 
          configurationProperties: {
            "hadoop.proxyuser.livy.groups": "*",
            "hadoop.proxyuser.livy.hosts": "*"
          }
        },
        {
          classification:"livy-conf", 
          configurationProperties: {
            "livy.impersonation.enabled": "true"
          }
        }
      ]
    });

    const sparkKafkaConsumerStep = new CfnStep(this, 'SparkKafkaConsumerStep', {
      actionOnFailure: 'CONTINUE',
      jobFlowId: cluster.ref,
      name: 'SparkKafkaConsumerStep',    
      hadoopJarStep: {
        jar: 'command-runner.jar',
        args: [
          'spark-submit',
          '--deploy-mode',
          'cluster',
          '--class',
          'org.apache.spark.examples.SparkPi',
          '/usr/lib/spark/examples/jars/spark-examples.jar',
          '10'
        ]
      }
    });

    new cdk.CfnOutput(this, 'SshEmrCluster', { value: `ssh -C -D 8157 hadoop@${cluster.attrMasterPublicDns}` });
  }
}