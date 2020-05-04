import cdk = require("@aws-cdk/core");
import ecr = require("@aws-cdk/aws-ecr");
import ecs = require("@aws-cdk/aws-ecs");
import codebuild = require("@aws-cdk/aws-codebuild");
import codepipeline = require("@aws-cdk/aws-codepipeline");
import actions = require("@aws-cdk/aws-codepipeline-actions");

interface CiCdStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}
export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CiCdStackProps) {
    super(scope, id);

    // Creates a CodeBuild project for our demo app to be used within the CodePipeline pipeline.
    // See docs for other default values - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-codebuild.PipelineProject.html
    const codebuildProject = new codebuild.PipelineProject(this, "BuildProject", {
      projectName: "ecsSampleAppBuildProject",
      environment: {
        computeType: codebuild.ComputeType.SMALL,
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
        privileged: true,
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: cdk.Aws.ACCOUNT_ID
          },
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: cdk.Aws.REGION
          }
        }
      }
    });
    // Grants required permissions on ECR to the CodeBuild project
    props.ecrRepository.grantPullPush(codebuildProject.grantPrincipal);

    const sourceOutput = new codepipeline.Artifact();
    // Source Action
    // NOTE: Replace 'owner' and 'oauthToken' with your own, see README.
    const sourceAction = new actions.GitHubSourceAction({
      actionName: "GitHub-Source",
      owner: "YOUR_OWN_GITHUB_ID",
      repo: "ecs-sample-app",
      branch: "master",
      oauthToken: cdk.SecretValue.secretsManager("/your/own/secret/github/token"),
      output: sourceOutput
    });
    const buildOutput = new codepipeline.Artifact();
    // Build Action, uses the CodeBuild project above
    const buildAction = new actions.CodeBuildAction({
      actionName: "Build",
      input: sourceOutput,
      outputs: [
        buildOutput
      ],
      project: codebuildProject
    });
    // Deploy Action
    const deployAction = new actions.EcsDeployAction({
      actionName: "DeployAction",
      service: props.ecsService,
      input: buildOutput
    });

    // Build the pipeline with the actions defined above
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "ecsSampleAppPipeline"
    });
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction]
    });
    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction]
    });
    pipeline.addStage({
      stageName: "Deploy",
      actions: [deployAction]
    });
  }
}
