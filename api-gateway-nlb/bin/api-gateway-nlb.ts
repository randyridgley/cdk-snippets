#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ApiGatewayNlbStack } from '../lib/api-gateway-nlb-stack';

const app = new cdk.App();
new ApiGatewayNlbStack(app, 'ApiGatewayNlbStack');
