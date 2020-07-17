#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LakeformationSetupStack } from '../lib/lakeformation-setup-stack';

const app = new cdk.App();
new LakeformationSetupStack(app, 'LakeformationSetupStack');
