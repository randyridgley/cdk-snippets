#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ClientVpnStack } from '../lib/client-vpn-stack';

const app = new cdk.App();
new ClientVpnStack(app, 'ClientVpnStack');
