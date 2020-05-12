import { AnyPrincipal, Effect, PolicyStatement } from '@aws-cdk/aws-iam'
import { Bucket, BucketProps } from '@aws-cdk/aws-s3'
import cdk = require('@aws-cdk/core')
import { RemovalPolicy } from '@aws-cdk/core'

export class ArtifactBucket extends Bucket {
  constructor(scope: cdk.Construct, id: string, props: BucketProps) {
    const bucketProps = {
      ...props,
      removalPolicy: RemovalPolicy.DESTROY,
    }
    super(scope, id, bucketProps)

    // this.addToResourcePolicy(
    //   new PolicyStatement({
    //     principals: [new AnyPrincipal()],
    //     effect: Effect.DENY,
    //     actions: ['s3:*'],
    //     conditions: {
    //       Bool: { 'aws:SecureTransport': false },
    //     },
    //     resources: [this.bucketArn + '/*'],
    //   }),
    // )
  }
}

export default ArtifactBucket