import * as cdk from '@aws-cdk/core';
import appstream = require('@aws-cdk/aws-appstream');
import ec2 = require('@aws-cdk/aws-ec2');

interface AppStackProps extends cdk.StackProps {
  userName: string;
}

export class AppStreamStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: cdk.Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'AppVPC', { cidr: '10.0.0.0/16' });

    const user = new appstream.CfnUser(this, 'testUser', {
      authenticationType: 'USERPOOL',
      userName: props.userName
    });

    const appStreamStack = new appstream.CfnStack(this, 'appStreamStack');

    appStreamStack.addDependsOn(user);

    const appStreamFleet = new appstream.CfnFleet(this, 'appStreamFleet', {
        computeCapacity: {
            desiredInstances: 1
        },
        fleetType: 'ON_DEMAND',
        instanceType: 'stream.standard.medium',
        vpcConfig: {
            subnetIds: [
                this.vpc.publicSubnets[0].subnetId
            ]
        },
        imageName: 'AWS\Amazon-AppStream2-Sample-Image-02-04-2019',
        name: 'test-fleet'
    });

    new appstream.CfnStackFleetAssociation(this, 'appStreamAssoc', {
        fleetName: appStreamFleet.ref,
        stackName: appStreamStack.ref
    });

    new appstream.CfnStackUserAssociation(this, 'userAssoc', {
      stackName: appStreamStack.ref,
      authenticationType: 'USERPOOL',
      userName: props.userName
    }).addDependsOn(appStreamStack);

  }
}
