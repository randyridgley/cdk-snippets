#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { S3NotificationLaunchStack } from '../lib/s3-notification-launch-stack';

const app = new cdk.App();
new S3NotificationLaunchStack(app, 'S3NotificationLaunchStack');
