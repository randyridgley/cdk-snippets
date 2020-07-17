# Vivotek FD9360-H CDK Configuration

This project provisions the required resources to stream video directly to KVS in an encrypted form. Standard useful commands below for cdk.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template


## Getting Started

Following this documentation seemed to work for me.

VADP Package (3.0.0.1)- Teleport for Amazon Kinesis Video Stream: http://download.vivotek.com/downloadfile/support/sdk/teleport.zip

Deployment Guide for Teleport package: http://download.vivotek.com/downloadfile/support/sdk/deployment_guide.zip

### Installing Teleport on Vivotek Camera

Follow the deployment guide above but if you run into issues you can watch the link below on how to properly install.
https://www.youtube.com/watch?v=o8DWLOUhEZc

## [Test the IoT Credentials Provider](https://docs.aws.amazon.com/iot/latest/developerguide/authorizing-direct-aws.html)

For testing purposes the cert, pub/priv keys get uploaded to the thing s3 bucket for download to add to the camera.
To verify they IoT credentials provider URL works you can run the curl command below.

``` bash

curl --cert certificate.pem.crt --key private.pem.key -H "x-amzn-iot-thingname: KVSCamera" --cacert AmazonRootCA1.pem https://c25abgae4qgt3n.credentials.iot.us-east-1.amazonaws.com/role-aliases/VivotekKVSRole/credentials

```

The result should be a json document like below: 

``` json 

{"credentials":{"accessKeyId":"access key","secretAccessKey":"secret access key","sessionToken":"session token","expiration":"2018-01-18T09:18:06Z"}}

```

## Troubleshooting

If using KMS for the KVS Stream ensure the console user has access to the KMS key as well to enable media playback in the console. To do so add the below to your KMS key resource policy.

``` json

    {
        "Sid": "Allow use of the key",
        "Effect": "Allow",
        "Principal": {
            "AWS": "arn:aws:iam::<AWS_ACCOUNT_ID>:user/<CONSOLE_USER>"
        },
        "Action": [
            "kms:Encrypt",
            "kms:Decrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey"
        ],
        "Resource": "*"
    }

```