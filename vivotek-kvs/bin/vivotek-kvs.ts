#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VivotekKvsStack } from '../lib/vivotek-kvs-stack';
import { KvsKitStack } from '../lib/kvs-kit-stack';
import { KvsKitFargateStack } from '../lib/kvs-kit-fargate-stack';

const app = new cdk.App();
const appName = 'VivotekSagemakerKitStack'
const vivotekStack = new VivotekKvsStack(app, 'VivotekKvsIotStack', {
    env: {
        region: 'us-east-1'
    }
});

const kitStack = new KvsKitStack(app, 'KVSKitStack', {
    appName: appName,
    endPointAcceptContentType: 'image/jpeg',
    sageMakerEndpoint: '',
    streamNames: '',
    tagFilters: '',
    env: {
        region: 'us-east-1'
    }
});
kitStack.addDependency(vivotekStack);

const kitFargateStack = new KvsKitFargateStack(app, 'KVSKitFargateStack', {
    appName: appName,
    dockerImageRepository: '528560246458.dkr.ecr.us-east-1.amazonaws.com/kinesisvideosagemakerintegration_release:V1.0.3',
    ddbTable: kitStack.ddbTable,
    kds: kitStack.kds,
    logGroup: kitStack.logGroup,
    env: {
        region: 'us-east-1'
    }
});

kitFargateStack.addDependency(kitStack);




