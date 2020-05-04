import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import KinesisFlinkGeo = require('../lib/kinesis-flink-geo-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new KinesisFlinkGeo.KinesisFlinkGeoStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
