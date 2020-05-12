#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CodepipelineAthenaDdlStack } from '../lib/codepipeline-athena-ddl-stack';

const app = new cdk.App();
new CodepipelineAthenaDdlStack(app, 'CodepipelineAthenaDdlStack', {
    contact: 'rridgley@amazon.com',
    emails: 'rridgley@amazon.com',
    gitOwner: 'randyridgley',
    githubBranch: 'master',
    githubRepository: 'cdk-snippets',
    gitTokenPath: 'randyridgley',
    owner: '12345'
});
