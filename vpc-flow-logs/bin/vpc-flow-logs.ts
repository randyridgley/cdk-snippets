#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VpcFlowLogsStack } from '../lib/vpc-flow-logs-stack';

const app = new cdk.App();
new VpcFlowLogsStack(app, 'VpcFlowLogsStack');
