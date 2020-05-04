#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
// import { EC2LaunchTemplateStack } from '../lib/ec2-launch-template-stack';
import { EC2FleetTemplateStack } from '../lib/ec2-fleet-launch-stack';

const app = new cdk.App();

const env = {
    region: app.node.tryGetContext('region') || process.env.CDK_INTEG_REGION || process.env.CDK_DEFAULT_REGION,
    account: app.node.tryGetContext('account') || process.env.CDK_INTEG_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT
};

// new EC2LaunchTemplateStack(app, 'EC2LaunchTemplateStack');
new EC2FleetTemplateStack(app, 'EC2FleetTemplateStack', { env });