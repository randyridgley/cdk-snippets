import cfn = require("@aws-cdk/aws-cloudformation");
import lambda = require("@aws-cdk/aws-lambda");
import cdk = require("@aws-cdk/core");
import iam = require("@aws-cdk/aws-iam");

import path = require("path");

export interface KVSResourceProps {
  account: string;
  stackName: string;
  kmsKeyId: string;
  streamName: string
}

export class KVSResource extends cdk.Construct {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: KVSResourceProps
  ) {
    super(scope, id);

    const custom_resource_lambda_role = new iam.Role(
      this,
      "CustomResourceLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
      }
    );

    custom_resource_lambda_role.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["lambda:InvokeFunction"]
      })
    );

    custom_resource_lambda_role.addToPolicy(
      new iam.PolicyStatement({
        resources: ["arn:aws:logs:*:*:*"],
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
      })
    );

    custom_resource_lambda_role.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "kinesisvideo:DescribeStream",
          "kinesisvideo:CreateStream",
          "kinesisvideo:DeleteStream"          
        ]
      })
    );

    const kvs_resource = new cfn.CustomResource(
      this,
      "KVSResource",
      {
        provider: cfn.CustomResourceProvider.lambda(
          new lambda.SingletonFunction(
            this,
            "KVSResourceFunction",
            {
              uuid: "f8d4f732-4ee1-11e8-9c2d-fa7ae01bbebb",
              code: lambda.Code.fromAsset(
                path.join(__dirname, "create-kvs-handler")
              ),
              handler: "create-kvs-lambda.handler",
              timeout: cdk.Duration.seconds(30),
              runtime: lambda.Runtime.PYTHON_3_6,
              role: custom_resource_lambda_role
            }
          )
        ),
        properties: props
      }
    );
  }
}