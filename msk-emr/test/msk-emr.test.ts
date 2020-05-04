import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import MskEmr = require('../lib/msk-cluster');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new MskEmr.MskEmrStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});