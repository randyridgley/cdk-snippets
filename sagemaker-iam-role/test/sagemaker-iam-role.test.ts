import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import SagemakerIamRole = require('../lib/sagemaker-iam-role-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new SagemakerIamRole.SagemakerIamRoleStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
