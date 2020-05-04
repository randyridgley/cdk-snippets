#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppStreamStack } from '../lib/appstream-cdk-stack';

const app = new cdk.App();

new AppStreamStack(app, 'AppStack', { 
    env: {
        region: 'us-west-2'
    },
    userName: 'rridgley@amazon.com'
});
