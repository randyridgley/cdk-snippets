import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import { SqsEventSource, SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import logs = require('@aws-cdk/aws-logs');
import s3 = require('@aws-cdk/aws-s3');
import sns = require('@aws-cdk/aws-sns');
import tasks = require('@aws-cdk/aws-stepfunctions-tasks');
import sfn = require('@aws-cdk/aws-stepfunctions');
import s3n = require('@aws-cdk/aws-s3-notifications');
import subscriptions = require('@aws-cdk/aws-sns-subscriptions');
import sqs = require('@aws-cdk/aws-sqs');
import { EmptyBucketOnDelete } from './empty-bucket';
import { RemovalPolicy, Duration } from '@aws-cdk/core';

export class S3NotificationLaunchStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * If left unchecked this pattern could "fan out" on the transform and load
     * lambdas to the point that it consumes all resources on the account. This is
     * why we are limiting concurrency to 2 on all 3 lambdas. Feel free to raise this.
     */
    const LAMBDA_THROTTLE_SIZE = 2;
    const containerName = 'AppContainer';
    const batchSize = 10;

    const bucket = new s3.Bucket(this, 'UploadBucket', {
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

    const topic = new sns.Topic(this, 'UploadBucketTopic');

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic));

    const queue = new sqs.Queue(this, 'newObjectInUploadBucketEventQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const sfnQueue = new sqs.Queue(this, 'newObjectInUploadBucketSfnEventQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const deadLetterQueue = new sqs.Queue(this, 'deadLetterQueue');

    
    const eventbridgePutPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['events:PutEvents']
    });

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    const cluster = new ecs.Cluster(this, 'Ec2Cluster', {
      vpc: vpc
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'FargateTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256
    });

    // We need to give our fargate container permission to put events on our EventBridge
    taskDefinition.addToTaskRolePolicy(eventbridgePutPolicy);
    bucket.grantRead(taskDefinition.taskRole);

    const logging = new ecs.AwsLogDriver({
      streamPrefix: 'UploadBatchETL',
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const container = taskDefinition.addContainer(containerName, {
      image: ecs.ContainerImage.fromAsset('container/s3data'),
      logging,
      environment: { 
        'S3_BUCKET_NAME': bucket.bucketName,
        'S3_OBJECT_KEY': ''
      },
    });

    const extractLambda = new lambda.Function(this, 'extractLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.asset('lambda/extract'), 
      handler: 'consumer.handler',
      reservedConcurrentExecutions: LAMBDA_THROTTLE_SIZE,
      environment: {
        CLUSTER_NAME: cluster.clusterName,
        TASK_DEFINITION: taskDefinition.taskDefinitionArn,
        SUBNETS: JSON.stringify(Array.from(vpc.privateSubnets, x => x.subnetId)),
        CONTAINER_NAME: container.containerName
      }
    });
    queue.grantConsumeMessages(extractLambda);
    extractLambda.addEventSource(new SqsEventSource(queue, {
      batchSize: batchSize
    }));
    extractLambda.addToRolePolicy(eventbridgePutPolicy);

    const runTaskPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:RunTask'
      ],
      resources: [
        taskDefinition.taskDefinitionArn,
      ]
    });
    extractLambda.addToRolePolicy(runTaskPolicyStatement);

    const taskExecutionRolePolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:PassRole',
      ],
      resources: [
        taskDefinition.obtainExecutionRole().roleArn,
        taskDefinition.taskRole.roleArn,
      ]
    });
    extractLambda.addToRolePolicy(taskExecutionRolePolicyStatement);

    const runTaskState = new sfn.Task(this, 'runTask', {
      task: new tasks.RunEcsFargateTask({
        cluster,
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
        taskDefinition: taskDefinition,
        containerOverrides: [{
          containerName: containerName,
          environment: [
            // {
            //   name: 'BODY',
            //   value: sfn.Data.stringAt('$.Record.body')
            // },
            // {
            //   name: 'EXECUTION_ID',
            //   value: sfn.Context.stringAt('$$.Execution.Id')
            // },
            {
              name: 'S3_BUCKET_NAME',
              value: bucket.bucketName
            },
            {
              name: 'S3_OBJECT_KEY',
              value: sfn.Data.stringAt('$.Record.s3.object.key')
            }
          ]
        }]
      })
    });

    const retryTask = new sfn.Task(this, 'retry', {
      task: new tasks.SendToQueue(deadLetterQueue, {
        messageBody: sfn.TaskInput.fromDataAt('$.Record.body')
      })
    });

    const stateMachine = new sfn.StateMachine(this, 'stateMachine', {
      definition: runTaskState.addCatch(retryTask, {
        resultPath: '$.ErrorInfo'
      })
    });

    // Lambda function that starts the state machine
    const stateMachineLambda = new lambda.Function(this, 'startMachine', {
      code: lambda.Code.asset('lambda/trigger-sfn'),
      handler: 'consumer.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn
      }
    });
    stateMachine.grantStartExecution(stateMachineLambda);

    topic.addSubscription(new subscriptions.SqsSubscription(queue));
    topic.addSubscription(new subscriptions.SqsSubscription(sfnQueue));

    const publishFunction = new lambda.Function(this, 'publishFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,    
      code: lambda.Code.asset('lambda/publish'),
      handler: 'publish.handler',
      environment: {
        QUEUE_URL: queue.queueUrl
      },
    });
    queue.grantSendMessages(publishFunction);
    // //Add subscription to invoke lamabda function
    publishFunction.addEventSource(new SnsEventSource(topic));
  }
}
