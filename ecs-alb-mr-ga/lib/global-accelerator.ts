import * as cdk from '@aws-cdk/core';
import ga = require('@aws-cdk/aws-globalaccelerator');
import r53 = require('@aws-cdk/aws-route53');

export interface GlobalAcceleratorProps extends cdk.StackProps {
  hostedZoneId: string,
  hostedZoneName: string
}

export class GlobalAcceleratorStack extends cdk.Stack {
  public readonly listenerArn: string;
  public readonly acceleratorArn: string;

  constructor(scope: cdk.Construct, id: string, props: GlobalAcceleratorProps) {
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

    const zone = r53.HostedZone.fromHostedZoneAttributes(this, "zone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName
    })

    const cname = new r53.RecordSet(this, 'GlobalAcceleratorCNAME', {
      zone,
      recordName: 'api',
      recordType: r53.RecordType.CNAME,
      target: r53.RecordTarget.fromValues(accelerator.getAtt('DnsName').toString())
    });
  }
}
