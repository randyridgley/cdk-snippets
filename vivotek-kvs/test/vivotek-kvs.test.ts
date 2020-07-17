import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as VivotekKvs from '../lib/vivotek-kvs-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new VivotekKvs.VivotekKvsStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
