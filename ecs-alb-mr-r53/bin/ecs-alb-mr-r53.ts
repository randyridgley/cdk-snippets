#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RegionServiceStack } from '../lib/ecs-alb-mr-r53-stack';
import { CreateHostedZoneStack } from '../lib/create-hosted-zone';
import { GlobalAcceleratorStack } from '../lib/global-accelerator';

const app = new cdk.App();

const ga = new GlobalAcceleratorStack(app, 'GlobalAcceleratorStack', {
  env: {
    region: 'us-west-2',
    account: process.env.CDK_DEFAULT_ACCOUNT
  }  
})

const west = new RegionServiceStack(app, 'West2RegionServiceStack', {  
  env: {
    region: 'us-west-2',
    account: process.env.CDK_DEFAULT_ACCOUNT
  },
  hostedZoneId: app.node.tryGetContext('hostedZoneId'),
  hostedZoneName: app.node.tryGetContext('hostedZoneName'),
  listenerArn: app.node.tryGetContext('listenerArn')
});

const east = new RegionServiceStack(app, 'East1RegionServiceStack', {  
  env: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT
  },
  hostedZoneId: app.node.tryGetContext('hostedZoneId'),
  hostedZoneName: app.node.tryGetContext('hostedZoneName'),
  listenerArn: app.node.tryGetContext('listenerArn')
});

new CreateHostedZoneStack(app, "hostedZone", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
