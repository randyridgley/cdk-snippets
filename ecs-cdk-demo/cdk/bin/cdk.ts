#!/usr/bin/env node

import cdk = require("@aws-cdk/core");
import 'source-map-support/register';
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CiCdStack } from "../lib/cicd-stack";

const app = new cdk.App();
const networkStack = new NetworkStack(app, "EcsSampleApp-Network");
const ecrStack = new EcrStack(app, "EcsSampleApp-ECR");
const ecsStack = new EcsStack(app, "EcsSampleApp-ECS", {
    vpc: networkStack.vpc,
    ecrRepository: ecrStack.ecrRepository
});
new CiCdStack(app, "EcsSampleApp-CICD", {
    ecrRepository: ecrStack.ecrRepository,
    ecsService: ecsStack.ecsService.service
});
