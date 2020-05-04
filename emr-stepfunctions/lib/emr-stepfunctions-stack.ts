import iam = require('@aws-cdk/aws-iam');
import sfn = require('@aws-cdk/aws-stepfunctions');
import sfn_tasks = require('@aws-cdk/aws-stepfunctions-tasks');
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');

export class EmrStepfunctionsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "vpc", {
      isDefault: true
    });

    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: vpc
    });

    const createCluster = new sfn.Task(this, 'CreateCluster', {
      task: new sfn_tasks.EmrCreateCluster({
        clusterRole: iam.Role.fromRoleArn(this, 'InstanceRole', this.formatArn({
          region: '',
          service: 'iam',
          resource: 'role',
          resourceName: 'EMR_EC2_DefaultRole'
        })),
        serviceRole: iam.Role.fromRoleArn(this, 'ServiceRole', this.formatArn({
          region: '',
          service: 'iam',
          resource: 'role',
          resourceName: 'EMR_DefaultRole'
        })),
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
        name: 'EMR Cluster',
        applications: [
          { name: 'Spark' },
          { name: 'Ganglia' },
          { name: 'Hive' },
          { name: 'Livy' }
        ],
        logUri: 's3://analytics-serverless-central/emr-logs/',
        instances: {
          instanceFleets: [            
            {
              instanceFleetType: sfn_tasks.EmrCreateCluster.InstanceRoleType.MASTER,
              targetOnDemandCapacity: 1,
              instanceTypeConfigs: [
                {
                  instanceType: 'c5.xlarge',
                }
              ],
              name: 'Master',
            }, 
            {
              instanceFleetType: sfn_tasks.EmrCreateCluster.InstanceRoleType.CORE,
              targetOnDemandCapacity: 1,
              instanceTypeConfigs: [
                {
                  instanceType: 'r5.xlarge',
                }
              ],
              name: 'Core',
            }, 
          ],        
          ec2KeyName: 'default-east-2',
          additionalMasterSecurityGroups: [
            sg.securityGroupName
          ],
          ec2SubnetId: vpc.publicSubnets[0].subnetId
        },
        releaseLabel: 'emr-5.29.0',
        visibleToAllUsers: true,
        configurations: [
          {
            classification: 'emrfs-site',
            properties: {                      
              "fs.s3.maxConnections": "1000"
            }
          },
          { 
            classification: 'hive-site',
            properties: {
              "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
            }
          },
          { 
            classification:"spark-hive-site", 
            properties: {
              "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
            }
          },
          {
            classification:"spark-defaults", 
            properties: {
              "spark.dynamicAllocation.enabled": "false",
              "spark.executor.cores": "2",
              "spark.executor.memory": "3g",
              "spark.executor.instances": "16"
            }
          },
          {
            classification:"core-site", 
            properties: {
              "hadoop.proxyuser.livy.groups": "*",
              "hadoop.proxyuser.livy.hosts": "*"
            }
          },
          {
            classification:"livy-conf", 
            properties: {
              "livy.impersonation.enabled": "true"
            }
          }
        ]
      }),
      resultPath: '$.CreateClusterResult'
    });

    const setTerminationProtected = new sfn.Task(this, 'TerminationProtected', {
      task: new sfn_tasks.EmrSetClusterTerminationProtection({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        terminationProtected: true
      }),
      resultPath: '$.TerminationProtectedResult'
    });

    const modifyInstanceFleet = new sfn.Task(this, 'ModifyInstanceFleet', {
      task: new sfn_tasks.EmrModifyInstanceFleetByName({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        instanceFleetName: 'Core',
        targetOnDemandCapacity: 2,
        targetSpotCapacity: 0
      }),
      resultPath: '$.ModifyInstanceFleetResult'
    });

    const step = new sfn.Task(this, 'Step', {
      task: new sfn_tasks.EmrAddStep({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        integrationPattern: sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
        name: 'The first step',
        actionOnFailure: sfn_tasks.ActionOnFailure.CONTINUE,
        jar: 'command-runner.jar',
        args: [
          'spark-submit',
          '--deploy-mode',
          'cluster',
          '--class',
          'org.apache.spark.examples.SparkPi',
          '/usr/lib/spark/examples/jars/spark-examples.jar',
          '10'
        ],
      }),
      resultPath: '$.StepResult'
    });

    const cancelStep = new sfn.Task(this, 'CancelStep', {
      task: new sfn_tasks.EmrCancelStep({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        stepId: sfn.TaskInput.fromDataAt('$.StepResult.StepId').value
      }),
      resultPath: '$.CancelStepResult'
    });

    const setTerminationUnprotected = new sfn.Task(this, 'TerminationUnprotected', {
      task: new sfn_tasks.EmrSetClusterTerminationProtection({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        terminationProtected: false
      }),
      resultPath: '$.TerminationUnprotectedResult'
    });


    const terminateCluster = new sfn.Task(this, 'TerminateCluster', {
      task: new sfn_tasks.EmrTerminateCluster({
        clusterId: sfn.TaskInput.fromDataAt('$.CreateClusterResult.ClusterId').value,
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC
      }),
      resultPath: '$.TerminateClusterResult'
    });
    
    const chain = sfn.Chain
      .start(createCluster)
      .next(setTerminationProtected)
      .next(modifyInstanceFleet)
      .next(step)
      .next(cancelStep)
      .next(setTerminationUnprotected)
      .next(terminateCluster);

    new sfn.StateMachine(this, 'StateMachine', {
      definition: chain
    });
  }
}