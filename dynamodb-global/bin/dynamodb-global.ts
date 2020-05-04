#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DynamodbGlobalStack } from '../lib/dynamodb-global-stack';

const app = new cdk.App();
new DynamodbGlobalStack(app, 'DynamodbGlobalStack', {
    env: {
        region: 'us-east-2'
    }
});
