import * as cdk from '@aws-cdk/core';
import fs = require('fs');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import iam = require('@aws-cdk/aws-iam');
import sns = require('@aws-cdk/aws-sns');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import lf = require('@aws-cdk/aws-lakeformation')
import glue = require('@aws-cdk/aws-glue')
import s3 = require('@aws-cdk/aws-s3')

import SecureBucket from './secure-bucket'
import { PipelineNotifications } from './pipeline-notifications'
import { CodeBuildProject } from './code-build-project'
import { PipelineBuildRole } from './pipeline-build-role'
import { EmptyBucketOnDelete } from './empty-bucket';

export interface PipelineStackProps extends cdk.StackProps {
  readonly gitOwner: string
  readonly gitTokenPath: string
  readonly gitRepository: string
  readonly gitBranch: string
  readonly contact: string
  readonly emails: string
  readonly dbName: string
}

const stages = ['test', 'prod']
const databases = ['iot']

export interface PipelineStage {
  readonly stage: string
  readonly bucket: s3.Bucket
  readonly database: string
}

export class CodepipelineAthenaDdlStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const artifactBucket = new SecureBucket(this, 'ArtifactBucket', {})
    
    const emptyBucket = new EmptyBucketOnDelete(this, 'ArtifactBucketEmpty', {
      bucket: artifactBucket
    });

    const codepipelineRole = new iam.Role(this, 'CodePipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });

    const codebuildRole = new PipelineBuildRole(this, 'CodeBuildTrustRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      stages,
      artifactBucket,
    });

    const adminRole = new lf.CfnDataLakeSettings(this, 'PipelineRoleAdmin', {
      admins: [{
          dataLakePrincipalIdentifier: codebuildRole.roleArn
        }        
      ]
    });

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

    const bucketRole = new iam.Role(this, 'LakeFormationBucketRole', {
      assumedBy: new iam.ServicePrincipal("lakeformation.amazonaws.com"),
      description: "Role used by lakeformation to access resources.",
      roleName: "LakeFormationServiceAccessRole"
    });

    const gitRepo = `https://github.com/${props.gitOwner}/${props.gitRepository}.git`

    const pipelineStages:PipelineStage[] = []

    databases.forEach(db => {
      stages.forEach(stage => {
        const bucketResource = stage + 'Bucket'
        const bucket = new SecureBucket(this, bucketResource, {})

        const emptyBucket = new EmptyBucketOnDelete(this, bucketResource + 'Empty', {
          bucket: bucket
        });

        bucket.grantReadWrite(bucketRole);
    
        const lfBucketResource = new lf.CfnResource(this, bucketResource + 'DataLocation', {
          resourceArn: bucket.bucketArn,
          roleArn: codebuildRole.roleArn,
          useServiceLinkedRole: true      
        });

        new s3deploy.BucketDeployment(this, stage + 'Deploy', {
          sources: [s3deploy.Source.asset('./data')],
          destinationBucket: bucket
        });

        const dlPermission = new lf.CfnPermissions(this, stage + 'DataLocationPermission', {
          dataLakePrincipal: {
            dataLakePrincipalIdentifier: codebuildRole.roleArn,        
          },
          resource: {            
            dataLocationResource: {
              s3Resource: bucket.bucketArn
            }
          },
          permissions: [
            'DATA_LOCATION_ACCESS'
          ]
        });
        dlPermission.node.addDependency(lfBucketResource)

        const dbName = stage + '_' + db

        pipelineStages.push({
          stage: stage,
          bucket: bucket,
          database: dbName
        })

        const glueDb = new glue.Database(this, dbName, {
          databaseName: dbName,
          locationUri: `s3://${bucket.bucketName}/`
        });
        
        glueDb.node.addDependency(adminRole)
        
        const dbPermission = new lf.CfnPermissions(this, stage + 'PipelineRolePermission', {
          dataLakePrincipal: {
            dataLakePrincipalIdentifier: codebuildRole.roleArn,        
          },
          resource: {
            databaseResource: {
              name: dbName
            }
          },
          permissions: [
            'ALTER',
            'CREATE_TABLE',
            'DROP'
          ],
          permissionsWithGrantOption: [
            'ALTER',
            'CREATE_TABLE',
            'DROP'            
          ]
        });

        dbPermission.node.addDependency(glueDb);
      })
    });

    pipelineStages.forEach(ps => {
      const stageProject = ps.stage + 'CodeBuildProject'
      const deployProject = new CodeBuildProject(this, stageProject, {
        ...props,
        stage: ps.stage,
        role: codebuildRole,
        databaseName: props.dbName,
        artifactBucket: artifactBucket,
        dataBucket: ps.bucket,
        gitRepoUrl: gitRepo,
        gitBranch: props.gitBranch
      })
      const deployToAction = new codepipeline_actions.CodeBuildAction({
        actionName: 'Build_and_Deploy',
        project: deployProject,
        input: sourceOutput    
      })
  
      if (ps.stage !== 'prod') {
        const stageApproval = ps.stage + 'PipelineApprovalTopic'
        const approvalTopic = new sns.Topic(this, stageApproval, {
          displayName: stageApproval,
        })

        const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
          actionName: 'ManualApprovalOf' + ps.stage,
          notificationTopic: approvalTopic,
          additionalInformation: 'Approve or Reject this change after testing'
        })
    
        pipeline.addStage({
          stageName: 'DeployTo' + ps.stage,
          actions: [deployToAction, manualApprovalAction],
        })
      } else {
        pipeline.addStage({
          stageName: 'DeployTo' + ps.stage,
          actions: [deployToAction],
        })
      }
    })
  }
}
