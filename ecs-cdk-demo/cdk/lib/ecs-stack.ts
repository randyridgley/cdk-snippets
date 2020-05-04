import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import ecr = require("@aws-cdk/aws-ecr");
import ecs = require("@aws-cdk/aws-ecs");
import ecsPatterns = require("@aws-cdk/aws-ecs-patterns");

interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ecrRepository: ecr.Repository;
}
export class EcsStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsService: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: cdk.App, id: string, props: EcsStackProps) {
    super(scope, id);

    // Creates an ECS cluster within the VPC.
    // See docs for other default values - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.Cluster.html
    this.ecsCluster = new ecs.Cluster(this, "Cluster", {
      clusterName: "demo-cluster",
      vpc: props.vpc
    });
    
    // Instantiate a Fargate Service with an Application Load Balancer using the container image sotred in ECR.
    // See docs for other default values - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs-patterns.ApplicationLoadBalancedFargateService.html
    this.ecsService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
      cluster: this.ecsCluster,
      desiredCount: 1,
      publicLoadBalancer: true,
      taskImageOptions: {
        containerName: "app",
        image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository)
      }
    });

  }
}
