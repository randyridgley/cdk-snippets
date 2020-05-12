import { Pipeline } from '@aws-cdk/aws-codepipeline';
import { EventField, RuleTargetInput } from '@aws-cdk/aws-events';
import { SnsTopic } from '@aws-cdk/aws-events-targets';
import { Subscription, SubscriptionProtocol, Topic } from '@aws-cdk/aws-sns';
import { Construct, Fn, StackProps } from '@aws-cdk/core';

export interface IPipelineNotificationsProps extends StackProps {
  readonly pipeline: Pipeline;
  readonly receivers: string;
  readonly messageText?: string;
}

export class PipelineNotifications extends Construct {
  constructor(scope: Construct, id: string, props: IPipelineNotificationsProps) {
    super(scope, id);

    const topic = new Topic(this, 'PipelineNotifications');
    const sub = new Subscription(this, 'PipelineSubscription', {
      endpoint: props.receivers,
      protocol: SubscriptionProtocol.EMAIL,
      topic,
    });
    const pipelineName = EventField.fromPath('$.detail.pipeline');
    const pipelineState = EventField.fromPath('$.detail.state');
    const pipelineBaseUrl = Fn.sub(
      'https://${AWS::Region}.console.aws.amazon.com/codepipeline/home?region=${AWS::Region}#/view/',
    );
    const message =
      props.messageText !== undefined
        ? RuleTargetInput.fromText(props.messageText)
        : RuleTargetInput.fromText(
          `The pipeline ${pipelineName} has changed state to ${pipelineState}. To view the pipeline, go to ${pipelineBaseUrl +
          pipelineName}.`,
        );
    const target = new SnsTopic(topic, { message });
    props.pipeline.onStateChange('OnStateChange', { target });
  }
}