import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import cfn = require('@aws-cdk/aws-cloudformation');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { BuildSpec } from '@aws-cdk/aws-codebuild';
import { BuildPipeline } from './build-pipeline-with-wait-condition';

export interface BuildArtifactsProps {
  bucket: s3.Bucket,
  flinkVersion: string,
  scalaVersion: string,
  flinkConsumerVersion: string
}

export class BuildArtifacts extends cdk.Construct {
  consumerBuildSuccessWaitCondition: cfn.CfnWaitCondition;
  producerBuildSuccessWaitCondition: cfn.CfnWaitCondition;

  constructor(scope: cdk.Construct, id: string, props: BuildArtifactsProps) {
    super(scope, id);

    const producer = new BuildPipeline(this, 'KinesisReplayBuildPipeline', {
      bucket: props.bucket,
      github: 'https://github.com/aws-samples/amazon-kinesis-replay/archive/master.zip',
      extract: true
    });

    this.producerBuildSuccessWaitCondition = producer.buildSuccessWaitCondition;

    const connectorArtifactName = 'FlinkKinesisConnector';
    const connectorKey = `target/flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.zip`

    new BuildPipeline(this, 'FlinkConnectorKinesisPipeline', {
      github: `https://github.com/apache/flink/archive/release-${props.flinkVersion}.zip`,
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              `cd flink-release-${props.flinkVersion}`,
              'mvn clean package -B -DskipTests -Dfast -Pinclude-kinesis -pl flink-connectors/flink-connector-kinesis'
            ]
          },
          post_build: {
            commands: [
              'cd flink-connectors/flink-connector-kinesis/target',
              `mv dependency-reduced-pom.xml flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.pom.xml`
            ]
          }
        },
        artifacts: {
          files: [
            `target/flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.jar`,
            `target/flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.pom.xml`
          ],
          'base-directory': `flink-release-${props.flinkVersion}/flink-connectors/flink-connector-kinesis`,
          'discard-paths': true
        }
      }),
      bucket: props.bucket,
      extract: false,
      objectKey: connectorKey
    });


    const consumer = new BuildPipeline(this, 'FlinkConsumer', {
      github: `https://github.com/aws-samples/amazon-kinesis-analytics-streaming-etl/archive/${props.flinkConsumerVersion}.zip`,
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              `mvn install:install-file -B -Dfile=$CODEBUILD_SRC_DIR_${connectorArtifactName}/flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.jar -DpomFile=$CODEBUILD_SRC_DIR_${connectorArtifactName}/flink-connector-kinesis_${props.scalaVersion}-${props.flinkVersion}.pom.xml`
            ]
          },
          build: {
            commands: [
              `cd amazon-kinesis-analytics-streaming-etl-${props.flinkConsumerVersion}`,
              `mvn clean package -B -Dflink.version=${props.flinkVersion}`
            ]
          }
        },
        artifacts: {
          files: [
            'target/amazon-kinesis-analytics-*.jar'
          ],
          'base-directory': `amazon-kinesis-analytics-streaming-etl-${props.flinkConsumerVersion}`,
          'discard-paths': false
        }
      }),
      bucket: props.bucket,
      extract: true,
      secondarySourceAction: new codepipeline_actions.S3SourceAction({
        actionName: 'FlinkKinesisConnectorSourceAction',
        bucket: props.bucket,
        bucketKey: connectorKey,
        output: new codepipeline.Artifact(connectorArtifactName)
      }),
    });

    this.consumerBuildSuccessWaitCondition = consumer.buildSuccessWaitCondition;
  }
}
