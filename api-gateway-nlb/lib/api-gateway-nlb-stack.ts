import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs =  require('@aws-cdk/aws-ecs');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import apigateway = require('@aws-cdk/aws-apigateway');

export class ApiGatewayNlbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 3 // Default is all AZs in region
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc
    });

    // Create a load-balanced Fargate service and make it public
    const service = new ecs_patterns.NetworkLoadBalancedFargateService(this, "MyFargateService", {
      cluster: cluster, // Required
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample")
      }
    });

    const allPorts = new ec2.Port({
      protocol: ec2.Protocol.TCP,
      fromPort: 0,
      toPort: 65535,
      stringRepresentation: 'All'
    })
    
    service.service.connections.allowFromAnyIpv4(allPorts);

    service.targetGroup.configureHealthCheck({
            port: "traffic-port",
            protocol: elbv2.Protocol.TCP
        }
    );

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: service.loadBalancer.loadBalancerDnsName });

    const nlb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(this, 'NLB', {
      loadBalancerArn: service.loadBalancer.loadBalancerArn,
    });

    const vpcLink = new apigateway.VpcLink(this, 'VPCLink', {
      description: 'VPCLink for our  REST API',
      vpcLinkName: 'tempVPCLink',
      targets: [
        nlb
      ]
    });

    const integrationOptions : apigateway.IntegrationOptions = {
      connectionType: apigateway.ConnectionType.VPC_LINK,
      vpcLink: vpcLink
    }
    const integrationProps : apigateway.HttpIntegrationProps = {
        httpMethod: 'GET',
        proxy: true,
        options: integrationOptions
    }
    const testIntegration = new apigateway.HttpIntegration(
        'http://' + service.loadBalancer.loadBalancerDnsName,
        integrationProps
    )

    const apiGateway = new apigateway.RestApi(this, `apigateway`, {
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    const test = apiGateway.root.addResource('test')
    test.addMethod('GET', testIntegration)
  }
}
