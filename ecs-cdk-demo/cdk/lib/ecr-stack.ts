import cdk = require("@aws-cdk/core");
import ecr = require("@aws-cdk/aws-ecr");

export class EcrStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // Creates an ECR repository.
    // See docs for other default values - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecr.Repository.html
    this.ecrRepository = new ecr.Repository(this, "Repository", {
      repositoryName: "demo/ecs-sample-app"
    });
  }
}