import cdk = require('@aws-cdk/core');
import kds = require('@aws-cdk/aws-kinesis')
import s3 = require('@aws-cdk/aws-s3')
import cloudwatch = require('@aws-cdk/aws-cloudwatch');

import { Metric } from '@aws-cdk/aws-cloudwatch';
import { Duration } from '@aws-cdk/core';

export interface StreamDashboardProps {
  bucket: s3.Bucket,
  stream: kds.Stream
}

export class StreamDashboard extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: StreamDashboardProps) {
    super(scope, id);

    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: cdk.Aws.STACK_NAME + '_' + props.stream.streamName
    });

    const incomingRecords = new Metric({
      namespace: 'AWS/Kinesis',
      metricName: 'IncomingRecords',
      dimensions: {
        StreamName: props.stream.streamName
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });

    const incomingBytes = new Metric({
      namespace: 'AWS/Kinesis',
      metricName: 'IncomingBytes',
      dimensions: {
        StreamName: props.stream.streamName
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });

    const outgoingRecords = new Metric({
      namespace: 'AWS/Kinesis',
      metricName: 'GetRecords.Records',
      dimensions: {
        StreamName: props.stream.streamName
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });

    const outgoingBytes = new Metric({
      namespace: 'AWS/Kinesis',
      metricName: 'GetRecords.Bytes',
      dimensions: {
        StreamName: props.stream.streamName
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });

    const bytesUploaded = new Metric({
      namespace: 'AWS/S3',
      metricName: 'BytesUploaded',
      dimensions: {
        BucketName: props.bucket.bucketName,
        FilterId: 'EntireBucket'
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });

    const putRequests = new Metric({
      namespace: 'AWS/S3',
      metricName: 'PutRequests',
      dimensions: {
        BucketName: props.bucket.bucketName,
        FilterId: 'EntireBucket'
      },
      period: Duration.minutes(1),
      statistic: 'sum'
    });


    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        left: [incomingRecords],
        right: [incomingBytes],
        width: 24,
        title: 'Kinesis data stream (incoming)',
        leftYAxis: {
          min: 0
        },
        rightYAxis: {
          min: 0
        }
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        left: [outgoingRecords],
        right: [outgoingBytes],
        width: 24,
        title: 'Kinesis data stream (outgoing)',
        leftYAxis: {
          min: 0
        },
        rightYAxis: {
          min: 0
        }
      })
    );

    // const millisBehindLatest = new Metric({
    //   namespace: 'AWS/KinesisAnalytics',
    //   metricName: 'millisBehindLatest',
    //   dimensions: {
    //     Id: cdk.Fn.join('_', cdk.Fn.split('-', props.stream.streamName)),
    //     Application: kdaApp.ref,
    //     Flow: 'Input'
    //   },
    //   period: Duration.minutes(1),
    //   statistic: 'max',
    // });

    // dashboard.addWidgets(
    //   new cloudwatch.GraphWidget({
    //     left: [
    //       millisBehindLatest,
    //       millisBehindLatest.with({
    //         statistic: "avg"
    //       })
    //     ],
    //     width: 24,
    //     title: 'Flink consumer lag',
    //     leftYAxis: {
    //       label: 'milliseconds',
    //       showUnits: false,
    //       min: 0
    //     }
    //   })
    // );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        left: [putRequests],
        right: [bytesUploaded],
        width: 24,
        title: 'Amazon S3 (incoming)',
        leftYAxis: {
          min: 0
        },
        rightYAxis: {
          min: 0
        }
      })
    );

    new cdk.CfnOutput(this, 'CloudwatchDashboard', { value: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=${cdk.Aws.STACK_NAME}` });
  }
}