import codebuild = require('@aws-cdk/aws-codebuild')
import { Role } from '@aws-cdk/aws-iam'
import cdk = require('@aws-cdk/core')
import s3 = require('@aws-cdk/aws-s3')

import { SecureBucket } from './secure-bucket'

export interface CodeBuildProjectProps extends codebuild.PipelineProjectProps {
  readonly stage: string
  readonly role: Role
  readonly contact: string
  readonly databaseName: string
  readonly artifactBucket: SecureBucket
  readonly dataBucket: SecureBucket
  readonly gitRepoUrl: string
  readonly gitBranch: string
}

export class CodeBuildProject extends codebuild.PipelineProject {
  constructor(scope: cdk.Construct, id: string, props: CodeBuildProjectProps) {
    const serviceStackName = `${scope.node.tryGetContext('serviceStackName') || 'build'}-${props.stage}`
    const pipelineProps = {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
        environmentVariables: {
          STACK_NAME: {
            value: serviceStackName,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          CI: {
            value: 'true',
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          STAGE: {
            value: props.stage,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          CONTACT: {
            value: props.contact,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          DATABASE: {
            value: props.databaseName,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,            
          },
          REPO_URL: {
            value: props.gitRepoUrl,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,            
          },
          REPO_BRANCH: {
            value: props.gitBranch,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,            
          }
        },
      },
      role: props.role,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          'git-credential-helper': 'yes',
        },
        phases: {
          install: {
            'runtime-versions': {
              python: 3.7,
            },
            commands: [
              'echo "Updating to latest boto versions"',
              'pip install --upgrade awscli',
              'pip install --upgrade boto3',
              'apt-get install -y jq'
            ],
          },
          pre_build: {
            commands: ['codepipeline-athena-ddl/scripts/codebuild-git-wrapper.sh "$REPO_URL" "$REPO_BRANCH"'],
          },
          build: {
            commands: ['codepipeline-athena-ddl/scripts/deploy.sh -d ' + props.databaseName + ' -e ' + props.stage + ' -l s3://' + props.artifactBucket.bucketName + '/' + props.stage + '/logs/ -b s3://' + props.dataBucket.bucketName + '/ -w codepipeline-athena-ddl/tables'],
          },
          post_build: {
            commands: [
            ],
          },
        },
        artifacts: {
          files: ['build/**/*'],
        },
      }),
    }
    super(scope, id, pipelineProps)
  }
}

export default CodeBuildProject