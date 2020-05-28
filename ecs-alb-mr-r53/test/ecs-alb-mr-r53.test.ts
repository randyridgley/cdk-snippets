import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as EcsAlbMrR53 from '../lib/ecs-alb-mr-r53-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new EcsAlbMrR53.RegionServiceStack(app, 'MyTestStack', {
      hostedZoneId: '123344',
      hostedZoneName: 'hostedZoneName',
      listenerArn: 'arn'
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
