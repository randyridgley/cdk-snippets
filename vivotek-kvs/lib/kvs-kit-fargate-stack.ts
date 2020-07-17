import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import iam = require('@aws-cdk/aws-iam');
import logs = require('@aws-cdk/aws-logs');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import kinesis = require('@aws-cdk/aws-kinesis');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import cloudwatch = require('@aws-cdk/aws-cloudwatch');
import cw_actions = require('@aws-cdk/aws-cloudwatch-actions');
import { KinesisEventSource } from '@aws-cdk/aws-lambda-event-sources';

export interface KvsKitFargateStackProps extends cdk.StackProps {
  kds: kinesis.Stream;
  ddbTable: dynamodb.Table;
  logGroup: logs.ILogGroup;
  appName: string;
  dockerImageRepository: string;
}

export class KvsKitFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: KvsKitFargateStackProps) {
    super(scope, id, props);

    const ecsRole = new iam.Role(this, 'ECSRole', {
      roleName: 'ECSKVSRole', 
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ]
    });

    ecsRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "ssm:GetParameter",
        "dynamodb:*",
        "kinesis:PutRecord",
        "kinesisvideo:Describe*",
        "kinesisvideo:Get*",
        "kinesisvideo:List*",
        "sagemaker:InvokeEndpoint"
      ],
      resources: [
        `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/*`,
        `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${props.ddbTable.tableName}`,
        `arn:aws:kinesis:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stream/${props.kds.streamName}`,
        `arn:aws:kinesisvideo:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stream/*`,
        `arn:aws:sagemaker:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:endpoint/*`
      ]
    }));

    ecsRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "tag:GetResources",
        "cloudwatch:PutMetricData"
      ],
      resources: ['*']
    }));

    //ECS Fargate Cluster, VPC, Dashboard
    const vpc = new ec2.Vpc(this, "FargateVPC", {
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "FargatePublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      natGateways: 0,
    });

    const cluster = new ecs.Cluster(this, "FargateCluster", {
      vpc: vpc,
      clusterName: "FargateCluster",
    });

    // ECS task definition
    const sagemakerTaskDef = new ecs.FargateTaskDefinition(this, 'SageMakerDriverTaskDefinition', {
        cpu: 1024,
        memoryLimitMiB: 2048,
        taskRole: ecsRole,
        executionRole: ecsRole
    })

    const sagemakerContainer = sagemakerTaskDef.addContainer('SageMakerDriver', {
      image: ecs.ContainerImage.fromRegistry(props.dockerImageRepository),
      cpu: 1024,
      memoryLimitMiB: 2048,
      logging: new ecs.AwsLogDriver({
          streamPrefix: `${props.appName}-SageMakerDriver`,
          logGroup: props.logGroup,
      }),
      dockerLabels: { Name: "ConsoleTemplate" },
      essential: true,
    })

    const sagemakerService = new ecs.FargateService(this, 'SageMakerDriverService', {
      cluster: cluster,
      desiredCount: 1,
      taskDefinition: sagemakerTaskDef,
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(this, 'SGSageMakerService', vpc.vpcDefaultSecurityGroup),
      assignPublicIp: true,
      serviceName: props.appName,
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC}
    });

    const scaling = sagemakerService.autoScaleTaskCount({
      maxCapacity: 5,
      minCapacity: 1
    });

    scaling.scaleOnMetric(props.appName + 'StepCpuScaling', {
      metric: sagemakerService.metricCpuUtilization(),    
      scalingSteps: [
        { upper: 10, change: -1 },
        { lower: 50, change: +10 },
        { lower: 70, change: +30 },
      ],
      cooldown: cdk.Duration.seconds(30),
      adjustmentType: autoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
    });

    const metric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensions: { ClusterName: cluster.clusterName, ServiceName: sagemakerService.serviceName }
    });

    const alarm = new cloudwatch.Alarm(this, 'Alarm', {
      metric: metric,
      threshold: 60,
      evaluationPeriods: 5,
      datapointsToAlarm: 2,
      statistic: "Average",
      period: cdk.Duration.seconds(300),
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "Alarm if ECS Cluster CPUUtilization reaches 60%",
    });

    const dashboard = new cloudwatch.Dashboard(this, 'PeakEventDashboard', {
      dashboardName: `${props.appName}-KvsSageMakerIntegration-${cdk.Aws.REGION}`
    });
  }
}
