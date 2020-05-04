#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { KinesisFlinkGeoStack } from '../lib/kinesis-flink-geo-stack';

const app = new cdk.App();
new KinesisFlinkGeoStack(app, 'KinesisFlinkGeoStack');
