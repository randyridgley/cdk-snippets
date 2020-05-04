import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import EmrStepfunctions = require('../lib/emr-stepfunctions-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new EmrStepfunctions.EmrStepfunctionsStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
