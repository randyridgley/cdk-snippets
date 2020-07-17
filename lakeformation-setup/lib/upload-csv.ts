import fs = require('fs');
import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import lambda = require('@aws-cdk/aws-lambda');
import cfn = require('@aws-cdk/aws-cloudformation');
import { Duration } from '@aws-cdk/core';
import { CustomResourceProvider } from '@aws-cdk/aws-cloudformation';


export interface UploadCSVOnCreateProps {
    bucket: s3.Bucket,
}

export class EmptyBucketOnDelete extends cdk.Construct {
    customResource: cfn.CfnCustomResource;

    constructor(scope: cdk.Construct, id: string, props: UploadCSVOnCreateProps) {
        super(scope, id);

        const lambdaSource = fs.readFileSync('lambda/importData.js').toString();

        const emptyBucketLambda =  new lambda.Function(this, 'UploadCSVLambda', {
            runtime: lambda.Runtime.NODEJS_12_X,
            timeout: Duration.minutes(15),
            code: lambda.Code.inline(lambdaSource),
            handler: 'index.empty_bucket',
            memorySize: 512,
            environment: {
                bucket_name: props.bucket.bucketName,
            }
        });

        props.bucket.grantReadWrite(emptyBucketLambda);

        this.customResource = new cfn.CfnCustomResource(this, 'EmptyBucketResource', {
            serviceToken: CustomResourceProvider.lambda(emptyBucketLambda).serviceToken
        });
    }
}