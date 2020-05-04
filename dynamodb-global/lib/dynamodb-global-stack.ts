import * as cdk from '@aws-cdk/core';
import { BillingMode, AttributeType, Table } from '@aws-cdk/aws-dynamodb';

export class DynamodbGlobalStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'global-demo-table', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: 'global-sample-table',
      partitionKey: {
          name: 'pk',
          type: AttributeType.STRING
      },
      replicationRegions: [
        'us-east-1',
        'us-west-2'
      ]
  })
  }
}
