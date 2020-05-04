import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import DynamodbGlobal = require('../lib/dynamodb-global-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new DynamodbGlobal.DynamodbGlobalStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
