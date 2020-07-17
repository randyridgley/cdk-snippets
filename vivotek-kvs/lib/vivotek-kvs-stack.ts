import * as cdk from '@aws-cdk/core';
import iam = require('@aws-cdk/aws-iam');
import iot = require('@aws-cdk/aws-iot');
import kms = require('@aws-cdk/aws-kms');
import s3 = require('@aws-cdk/aws-s3');

import { CustomCertificateResource } from "./custom-certificate-resource";
import { KVSResource } from "./kvs-resource";
import { AutoDeleteBucket } from '@mobileposse/auto-delete-bucket'

export class VivotekKvsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const thingBucket = new AutoDeleteBucket(this, 'DataLakeBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const encryptionKey = new kms.Key(this, 'KmsKey', {
      alias: 'kvs-kms-key',
      description: 'KMS key for KVS and Vivotek Camera',
      enabled: true,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const cameraRole = new iam.Role(this, 'SecureCameraRole', {
      roleName: 'VivotekKVSRole', 
      assumedBy: new iam.ServicePrincipal('credentials.iot.amazonaws.com'),
    });

    encryptionKey.grantEncryptDecrypt(cameraRole);
    
    cameraRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "kinesisvideo:DescribeStream", 
        "kinesisvideo:PutMedia", 
        "kinesisvideo:ListFragments", 
        "kinesisvideo:ListStreams", 
        "kinesisvideo:CreateStream", 
        "kinesisvideo:UpdateStream", 
        "kinesisvideo:DeleteStream", 
        "kinesisvideo:UpdateDataRetention", 
        "kinesisvideo:GetDataEndpoint"
      ],
      resources: ['*']
    }));

    cameraRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "sts:AssumeRole", 
      ],
      resources: ['*']
    }));

    const iotThing = new iot.CfnThing(this, "KVSCamera", {
      thingName: "KVSCamera"
    });

    if (iotThing.thingName !== undefined) {
      const thingArn = `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:thing/${iotThing.thingName}`

      const iotPolicy = new iot.CfnPolicy(this, 'Policy', {
        policyName: 'KVS_Camera_Policy',
        policyDocument: {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "iot:Connect",
                "iot:CreateRoleAlias"
              ],
              "Resource": [
                "*"
              ]
            },
            {
              "Effect": "Allow",
              "Action": [
                "iot:Publish",
              ],
              "Resource": [
                `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/$aws/things/${iotThing.thingName}/*`,
                `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/cameras/${iotThing.thingName}/*`  
              ]
            },
            {
              "Effect": "Allow",
              "Action": [
                "iot:assumeRoleWithCertificate",
              ],
              "Resource": [
                `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rolealias/${cameraRole.roleName}`
              ]
            },
          ]
        }
      })
      iotPolicy.addDependsOn(iotThing)

      const coreCredentials = new CustomCertificateResource(
        this,
        "CoreCredentials",
        {
          account: this.account,
          stackName: this.stackName,
          thingName: iotThing.thingName!,
          roleArn: cameraRole.roleArn,
          roleAlias: cameraRole.roleName,
          s3BucketName: thingBucket.bucketName
        }
      );

      if (iotPolicy.policyName !== undefined) {
        const policyPrincipalAttachment = new iot.CfnPolicyPrincipalAttachment(this, 'PolicyPrincipalAttachment', {
          policyName: iotPolicy.policyName,
          principal: coreCredentials.certificateArn
        })
        policyPrincipalAttachment.addDependsOn(iotPolicy)
      }

      const thingPrincilatAttachment = new iot.CfnThingPrincipalAttachment(this, "ThingPrincipalAttachment", {
        thingName: iotThing.thingName,
        principal: coreCredentials.certificateArn
      })
      thingPrincilatAttachment.addDependsOn(iotThing)

      const kvsResource = new KVSResource(
        this,
        "KVSCustomResource",
        {
          account: this.account,
          stackName: this.stackName,
          streamName: iotThing.thingName!,
          kmsKeyId: encryptionKey.keyId
        }
      );

      new cdk.CfnOutput(this, 'IoTThingName', {
        value: iotThing.thingName,
      });

      new cdk.CfnOutput(this, 'IoTEndpointUrl', {
        value: coreCredentials.iotEndpoint,
      });

      new cdk.CfnOutput(this, 'IoTCredentialEndpointURL', {
        value: `https://${coreCredentials.iotCredentialEndpoint}/role-aliases/${cameraRole.roleName}/credentials`,
      });

      new cdk.CfnOutput(this, 'KVSStreamName', {
        value: iotThing.thingName,
      });

      new cdk.CfnOutput(this, 'Region', {
        value: cdk.Aws.REGION,
      });

      new cdk.CfnOutput(this, 'KmsKeyId', {
        value: `arn:aws:kms:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:key/${encryptionKey.keyId}`,
      });

      new cdk.CfnOutput(this, 'RootAmazonCert', {
        value: "https://www.amazontrust.com/repository/AmazonRootCA1.pem",
      });
      
      new cdk.CfnOutput(this, 'ThingBucket', {
        value: thingBucket.bucketName,
      });
    }
  }
}
