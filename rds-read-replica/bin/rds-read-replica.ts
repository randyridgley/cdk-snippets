#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RdsReadReplicaStack } from '../lib/rds-read-replica-stack';

const app = new cdk.App();
new RdsReadReplicaStack(app, 'RdsReadReplicaStack');
