#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SagemakerIamRoleStack } from '../lib/sagemaker-iam-role-stack';

const app = new cdk.App();
new SagemakerIamRoleStack(app, 'SagemakerIamRoleStack');
