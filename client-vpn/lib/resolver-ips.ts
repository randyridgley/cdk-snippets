import cfn = require("@aws-cdk/aws-cloudformation");
import lambda = require("@aws-cdk/aws-lambda");
import cdk = require("@aws-cdk/core");
import iam = require("@aws-cdk/aws-iam");

import path = require("path");

export interface CustomResolverIpResourceProps {
  resolverId: string;
}

export class CustomResolverIpResource extends cdk.Construct {
  public readonly ipAddress1: string;
  public readonly ipAddress2: string;

  constructor(
    scope: cdk.Construct,
    id: string,
    props: CustomResolverIpResourceProps
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
        resources: ['*'],
        actions: [
          "route53resolver:ListResolverEndpointIpAddresses"
        ]
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

    const custom_resolver_ip_resource = new cfn.CustomResource(
      this,
      "ResolverIps",
      {
        provider: cfn.CustomResourceProvider.lambda(
          new lambda.SingletonFunction(
            this,
            "CustomResolverIpResourceFunction",
            {
              uuid: "e8d4f732-4ee1-11e8-9c2d-fa7ae01bbebc",
              code: lambda.Code.fromAsset(
                path.join(__dirname, "resolver-ip-handler")
              ),
              handler: "resolver-ip-lambda.handler",
              timeout: cdk.Duration.seconds(30),
              runtime: lambda.Runtime.PYTHON_3_6,
              role: custom_resource_lambda_role
            }
          )
        ),
        properties: props
      }
    );

    this.ipAddress1 = custom_resolver_ip_resource
      .getAtt("IpAddress1").toString();

    this.ipAddress2 = custom_resolver_ip_resource
      .getAtt("IpAddress2").toString(); 
  }
}