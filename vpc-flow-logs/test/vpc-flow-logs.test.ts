import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import VpcFlowLogs = require('../lib/vpc-flow-logs-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new VpcFlowLogs.VpcFlowLogsStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
