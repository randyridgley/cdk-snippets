import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as CodepipelineAthenaDdl from '../lib/codepipeline-athena-ddl-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CodepipelineAthenaDdl.CodepipelineAthenaDdlStack(app, 'MyTestStack', {
      contact: 'rridgley@amazon.com',
      emails: 'rridgley@amazon.com',
      gitOwner: 'randyridgley',
      gitBranch: 'master',
      gitRepository: 'cdk-snippets',
      gitTokenPath: 'randyridgley',
      dbName: 'iot'
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
