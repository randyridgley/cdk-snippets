import * as cdk from '@aws-cdk/core';
import ec2 =  require('@aws-cdk/aws-ec2');
import lambda = require('@aws-cdk/aws-lambda');
import apigateway = require('@aws-cdk/aws-apigateway');

import fs = require('fs')

export class ApiGatewayLambdaVpcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 2,
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

    const helloFn = new lambda.Function(this, 'HelloFunction', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/lambda-handler.py', { encoding: 'utf-8' })),
      handler: 'index.handler',
      runtime: lambda.Runtime.PYTHON_3_7,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 512,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE
      }
    })

    const api = new apigateway.LambdaRestApi(this, 'HelloRestApi', {
      handler: helloFn,
      endpointTypes: [apigateway.EndpointType.REGIONAL]
    })
  }
}
