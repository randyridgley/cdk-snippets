#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkResearchNotebookStack } from '../lib/cdk-research-notebook-stack';

const app = new cdk.App();
new CdkResearchNotebookStack(app, 'CdkResearchNotebookStack');
