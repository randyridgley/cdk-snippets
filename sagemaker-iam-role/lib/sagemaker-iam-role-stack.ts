import * as cdk from '@aws-cdk/core';
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');

export class SagemakerIamRoleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sagemakerRole = new iam.Role(this, 'SmRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess') ],
    });

    const userBucket = new s3.Bucket(this, "UserBucket");
    userBucket.grantReadWrite(sagemakerRole);
  }
}
