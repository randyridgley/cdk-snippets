#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EmrStepfunctionsStack } from '../lib/emr-stepfunctions-stack';

const app = new cdk.App();
const mskEmr = new EmrStepfunctionsStack(app, 'EmrStepfunctionsStack', {
    env: {
        region: 'us-east-2', //process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
    }
});