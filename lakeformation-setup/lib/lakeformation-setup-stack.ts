import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import glue = require('@aws-cdk/aws-glue');
import lf = require('@aws-cdk/aws-lakeformation');
import iam = require('@aws-cdk/aws-iam');

import { EmptyBucketOnDelete } from './empty-bucket';

export class LakeformationSetupStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "LFDemoBucket", {
      bucketName: `lf-demo-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const emptyBucket = new EmptyBucketOnDelete(this, 'LFDemoBucketEmpty', {
      bucket: bucket
    });

    const rawDatabase = new glue.Database(this, 'RawEventsDatabase', {
      databaseName: 'raw_events'
    });

    const processedDatabase = new glue.Database(this, 'ProcessedEventsDatabase', {
      databaseName: 'processed_events'
    });

    const workflowRole = new iam.Role(this, 'WorkflowRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')
      ],
      inlinePolicies: {
        LakeFormationPermissionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "lakeformation:GetDataAccess",
                "lakeformation:GrantPermissions"
              ],
              resources: [
                "*"
              ]
            })
          ]
        })
      }
    });

    const passWorkflowRolePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:PassRole'
      ],
      resources: [
        workflowRole.roleArn
      ]
    });

    workflowRole.addToPolicy(passWorkflowRolePolicy);
    workflowRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [
        bucket.arnForObjects('*')
      ]
    }));

    const datalakeAdministratorRole = new iam.Role(this, 'DatalakeAdministratorRole', {
      roleName: 'DataLakeAdministrator',
      assumedBy: new iam.ServicePrincipal('lakeformation.amazonaws.com'),
    });

    datalakeAdministratorRole.attachInlinePolicy(new iam.Policy(this, 'DatalakeAdministratorBasic', {
      statements: [new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lakeformation:*',
          'cloudtrail:DescribeTrails',
          'cloudtrail:LookupEvents'
        ],
        resources: [
          '*'
        ]
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: [
          'lakeformation:PutDataLakeSettings'
        ],
        resources: [
          '*'
        ]
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:CreateServiceLinkedRole'
        ],
        resources: [
          '*'
        ],
        conditions: {
          StringEquals: {
            'iam:AWSServiceName': 'lakeformation.amazonaws.com'
          }
        }
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:PutRolePolicy'
        ],
        resources: [
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/lakeformation.amazonaws.com/AWSServiceRoleForLakeFormationDataAccess`
        ]
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: [
          'lakformation:GetDataAccess',
          'lakeformation:GrantPermissions'
        ],
      })]
    }));
    datalakeAdministratorRole.addToPolicy(passWorkflowRolePolicy);
    
    // https://docs.aws.amazon.com/lake-formation/latest/dg/getting-started-setup.html#create-data-lake-admin
    datalakeAdministratorRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLakeFormationDataAdmin'));
    datalakeAdministratorRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'))

    // LF Admin Role
    const lfAdminRole = new lf.CfnDataLakeSettings(this, 'LFDataLakeRoleAdminSetting', {
      admins: [{
        dataLakePrincipalIdentifier: datalakeAdministratorRole.roleArn
      }]
    });
    lfAdminRole.node.addDependency(datalakeAdministratorRole)
  }
}
