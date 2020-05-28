import * as cdk from '@aws-cdk/core';
import ga = require('@aws-cdk/aws-globalaccelerator');

export class GlobalAcceleratorStack extends cdk.Stack {
  public readonly listenerArn: string;
  public readonly acceleratorArn: string;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const accelerator = new ga.CfnAccelerator(this, 'GlobalAccelerator', {
      name: `accelerator-${cdk.Aws.STACK_NAME}`,
      enabled: true,
      ipAddressType: 'IPV4'
    });

    this.acceleratorArn = accelerator.ref;

    const listener = new ga.CfnListener(this, 'GAListener', {
      acceleratorArn: accelerator.ref,
      portRanges: [{
        fromPort: 80,
        toPort: 80        
      }],
      protocol: 'TCP',
      clientAffinity: 'NONE'
    });

    this.listenerArn = listener.ref
  }
}
