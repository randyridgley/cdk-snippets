import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import iam = require("@aws-cdk/aws-iam");

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // Creates a VPC across 2 AZs with a NAT Gateway each.
    // See docs for other default values - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.Vpc.html
    this.vpc = new ec2.Vpc(this, "VPC", {
      natGateways: 2,
      maxAzs: 2
    });

  }
}
