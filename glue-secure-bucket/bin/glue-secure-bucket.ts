#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { GlueSecureBucketStack } from '../lib/glue-secure-bucket-stack';

const app = new cdk.App();
new GlueSecureBucketStack(app, 'GlueSecureBucketStack');
