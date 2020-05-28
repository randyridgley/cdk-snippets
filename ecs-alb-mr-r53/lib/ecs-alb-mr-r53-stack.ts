import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import logs = require('@aws-cdk/aws-logs');
import ecsPatterns = require('@aws-cdk/aws-ecs-patterns');
import ga = require('@aws-cdk/aws-globalaccelerator');

export interface RegionServiceProps extends cdk.StackProps {
  hostedZoneId: string,
  hostedZoneName: string,
  listenerArn: string   
}

export class RegionServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RegionServiceProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    const cluster = new ecs.Cluster(this, 'Ec2Cluster', {
      vpc: vpc,
      clusterName: "app-cluster"
    });

    const logging = new ecs.AwsLogDriver({
      streamPrefix: 'expressApp',
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    cluster.addCapacity("app-scaling-group", {
      instanceType: new ec2.InstanceType("t2.micro"),
      desiredCapacity: 2
    });

    const loadBalancedService = new ecsPatterns.ApplicationLoadBalancedEc2Service(this, "express-service", {
      cluster,
      memoryLimitMiB: 128,
      cpu: 1,
      desiredCount: 2,
      serviceName: "express-app",
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset("container/express"),
        containerPort: 8080,
        logDriver: logging
      },
      publicLoadBalancer: true
    });    

    const autoScalingGroup = loadBalancedService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10
    });

    autoScalingGroup.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    loadBalancedService.targetGroup.configureHealthCheck({
      port: 'traffic-port',
      path: '/',
      interval: cdk.Duration.seconds(5),
      timeout: cdk.Duration.seconds(4),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      healthyHttpCodes: "200,301,302"
    })

    const region = cdk.Aws.REGION

    new ga.CfnEndpointGroup(this, "endpoint", {
      endpointGroupRegion: cdk.Aws.REGION,
      listenerArn: props.listenerArn,
      endpointConfigurations: [
        {
          endpointId: loadBalancedService.loadBalancer.loadBalancerArn,
          weight: 50
        }
      ],
      healthCheckPort: 80,
      healthCheckProtocol: 'HTTP',
      healthCheckPath: '/'
    })
  }
}
