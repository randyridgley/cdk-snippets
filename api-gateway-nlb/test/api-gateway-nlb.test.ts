import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import ApiGatewayNlb = require('../lib/api-gateway-nlb-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ApiGatewayNlb.ApiGatewayNlbStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
