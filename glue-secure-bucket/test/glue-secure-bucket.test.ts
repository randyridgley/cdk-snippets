import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as GlueSecureBucket from '../lib/glue-secure-bucket-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new GlueSecureBucket.GlueSecureBucketStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
