import * as cdk from '@aws-cdk/core';
import fs = require('fs');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import iam = require('@aws-cdk/aws-iam');
import sns = require('@aws-cdk/aws-sns');

import ArtifactBucket from './artifact-bucket'
import { PipelineNotifications } from './pipeline-notifications'
import { CodeBuildProject } from './code-build-project'
import { PipelineBuildRole } from './pipeline-build-role'

export interface PipelineStackProps extends cdk.StackProps {
  readonly gitOwner: string
  readonly gitTokenPath: string
  readonly gitRepository: string
  readonly gitBranch: string
  readonly contact: string
  readonly owner: string
  readonly emails: string
}

const stages = ['test', 'prod']
const dbName = 'home'

export class CodepipelineAthenaDdlStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const artifactBucket = new ArtifactBucket(this, 'ArtifactBucket', {})

    const codepipelineRole = new iam.Role(this, 'CodePipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    })
    const codebuildRole = new PipelineBuildRole(this, 'CodeBuildTrustRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      stages,
      artifactBucket,
    })

    const sourceOutput = new codepipeline.Artifact("DataLake-TableSource");

    const pipeline = new codepipeline.Pipeline(this, 'DataLakeTable-Pipeline', {
      artifactBucket,
      role: codepipelineRole,
    });
    
    new PipelineNotifications(this, 'PipelineNotifications', {
      pipeline,
      receivers: props.emails,
    })

    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GithubCode',
      owner: props.gitOwner,
      repo: props.gitRepository,
      branch: props.gitBranch,
      oauthToken: cdk.SecretValue.secretsManager(props.gitTokenPath, { jsonField: 'password' }),
      output: sourceOutput,
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
    })

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    })

    // DEPLOY TO TEST
    const deployToTestProject = new CodeBuildProject(this, 'CodeBuildTestBuildProject', {
      ...props,
      stage: 'test',
      role: codebuildRole,
      databaseName: dbName,
      bucket: artifactBucket
    })
    const deployToTestAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build_and_Deploy',
      project: deployToTestProject,
      input: sourceOutput    
    })

    const approvalTopic = new sns.Topic(this, 'PipelineApprovalTopic', {
      displayName: 'PipelineApprovalTopic',
    })
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'ManualApprovalOfENvironment',
      notificationTopic: approvalTopic,
      additionalInformation: 'Approve or Reject this change after testing'
    })

    // TEST STAGE
    pipeline.addStage({
      stageName: 'DeployToTest',
      actions: [deployToTestAction, manualApprovalAction],
    })

    // DEPLOY TO PROD
    const deployToProdProject = new CodeBuildProject(this, 'CodeBuildProdBuildProject', {
      ...props,
      stage: 'prod',
      role: codebuildRole,
      databaseName: dbName,
      bucket: artifactBucket
    })
    const deployToProdAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build_and_Deploy',
      project: deployToProdProject,
      input: sourceOutput
    })

    // PROD STAGE
    pipeline.addStage({
      stageName: 'DeployToProd',
      actions: [deployToProdAction],
    })
  }
}
