# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template


After deployment you should be able to run the raw crawler. After table is populated in secure_db as r_sensors you need to add SELECT permissions in lakeformation for the console user you wish to use as well as the glue role that will be executing the job.

Add console user to the kms key to encrypt/decrypt if you need to view/edit Glue Job.

``` json
{
    "Effect": "Allow",
    "Principal": {
        "AWS": "arn:aws:iam::649037252677:user/<console_user>"
    },
    "Action": [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:Encrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*"
    ],
    "Resource": "*"
}
```