import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import RdsReadReplica = require('../lib/rds-read-replica-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new RdsReadReplica.RdsReadReplicaStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
