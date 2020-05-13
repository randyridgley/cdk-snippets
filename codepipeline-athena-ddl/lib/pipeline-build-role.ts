import { PolicyStatement, Role, RoleProps } from '@aws-cdk/aws-iam'
import { Bucket } from '@aws-cdk/aws-s3'
import cdk = require('@aws-cdk/core')
import { Fn } from '@aws-cdk/core'

export interface PipelineBuildRoleProps extends RoleProps {
  readonly stages: string[]
  readonly artifactBucket: Bucket
}

export class PipelineBuildRole extends Role {
  constructor(scope: cdk.Construct, id: string, props: PipelineBuildRoleProps) {
    super(scope, id, props)

    const serviceStackPrefix = scope.node.tryGetContext('serviceStackName') || 'usurper'
    const serviceStacks = props.stages.map(stage => `${serviceStackPrefix}-${stage}`)

    // Allow checking what policies are attached to this role
    this.addToPolicy(
      new PolicyStatement({
        resources: [this.roleArn],
        actions: ['iam:GetRolePolicy'],
      }),
    )
    // Allow modifying IAM roles related to our application
    const iamStatement = new PolicyStatement({
      resources: [], // Added later dynamically
      actions: [
        'iam:GetRole',
        'iam:GetRolePolicy',
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:DeleteRolePolicy',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:PassRole',
        'iam:TagRole',
      ],
    })
    serviceStacks.forEach(stackName => {
      iamStatement.addResources(Fn.sub('arn:aws:iam::${AWS::AccountId}:role/' + stackName + '*'))
    })
    this.addToPolicy(iamStatement)

    // Global resource permissions for managing logs
    this.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: [
          'cloudformation:ListExports',
          'logs:CreateLogGroup',
        ],
      }),
    )

    // Allow logging for this stack
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          Fn.sub('arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/${AWS::StackName}-*'),
        ],
        actions: ['logs:CreateLogStream'],
      }),
    )
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          Fn.sub(
            'arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/${AWS::StackName}-*:log-stream:*',
          ),
        ],
        actions: ['logs:PutLogEvents'],
      }),
    )

    // Allow storing artifacts in S3 buckets
    this.addToPolicy(
      new PolicyStatement({
        resources: [props.artifactBucket.bucketArn, 'arn:aws:s3:::cdktoolkit-stagingbucket-*'],
        actions: ['s3:ListBucket'],
      }),
    )
    this.addToPolicy(
      new PolicyStatement({
        resources: [props.artifactBucket.bucketArn + '/*', 'arn:aws:s3:::cdktoolkit-stagingbucket-*/*'],
        actions: ['s3:GetObject', 's3:PutObject'],
      }),
    )

    // Allow creating and managing glue resources with this stack name 
    const glueStatement = new PolicyStatement({
      resources: ['*'], // Added later dynamically
      actions: ['glue:*'],
    })
    this.addToPolicy(glueStatement)

    // Allow creating and managing glue resources with this stack name 
    const athenaStatement = new PolicyStatement({
      resources: ['*'], // Added later dynamically
      actions: ['athena:*'],
    })
    this.addToPolicy(athenaStatement)
    
    // Allow fetching details about and updating the application stack
    const cfnStatement = new PolicyStatement({
      resources: [], // Added later dynamically
      actions: [
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackEvents',
        'cloudformation:DescribeChangeSet',
        'cloudformation:CreateChangeSet',
        'cloudformation:ExecuteChangeSet',
        'cloudformation:DeleteChangeSet',
        'cloudformation:DeleteStack',
        'cloudformation:GetTemplate',
      ],
    })
    serviceStacks.forEach(stackName => {
      cfnStatement.addResources(
        Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/' + stackName + '/*'),
      )
    })
    this.addToPolicy(cfnStatement)

    // Allow reading some details about CDKToolkit stack so we can use the CDK CLI successfully from CodeBuild.
    this.addToPolicy(
      new PolicyStatement({
        resources: [Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/CDKToolkit/*')],
        actions: ['cloudformation:DescribeStacks'],
      }),
    )    
  }
}

export default PipelineBuildRole