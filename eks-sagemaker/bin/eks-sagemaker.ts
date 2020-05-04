#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { EksSagemakerStack } from '../lib/eks-sagemaker-stack';

const app = new cdk.App();
new EksSagemakerStack(app, 'EksSagemakerStack');
