import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import route53 = require('@aws-cdk/aws-route53');
import r53resolver = require('@aws-cdk/aws-route53resolver');

import { CustomResolverIpResource } from "./resolver-ips";

export class ClientVpnStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      cidr: '10.0.0.0/16',    
      subnetConfiguration: [
        {
          cidrMask: 24,        
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC          
        },
        {
          cidrMask: 24,
          name: 'application',
          subnetType: ec2.SubnetType.PRIVATE
        },
        {
          cidrMask: 24,
          name: 'db',
          subnetType: ec2.SubnetType.ISOLATED
        },
        {
          cidrMask: 27,
          name: 'ovpn',
          subnetType: ec2.SubnetType.ISOLATED
        }
      ]
    })

    const instance = new ec2.Instance(this, 'Instance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpc,
    })

    new cdk.CfnOutput(this, 'Ec2Ip', { value: instance.instancePrivateIp })

    // allow icmp ping from any internal instance sharing the default vpc security group
    instance.connections.allowInternally(ec2.Port.icmpPing())
    // allow icmp ping from the whole vpc cidr block
    instance.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.icmpPing())

    const certArn = 'arn:aws:acm:us-east-1:649037252677:certificate/e856a2a4-4e18-4b80-b1fd-93b1f7d2ba80'

    const hostedZone = new route53.PrivateHostedZone(this, 'PrivateZone', {
      vpc: vpc,
      zoneName: '7layerburrito.internal'      
    });

    new route53.ARecord(this, "Record", {
      zone: hostedZone,
      recordName: "dev",
      target: {
        values: [instance.instancePrivateIp]
      },
      ttl: cdk.Duration.seconds(300),
      comment: "dev endpoint for internal zone"
    });

    const resolverSG = new ec2.SecurityGroup(this, 'ResolverSecurityGroup', {
      securityGroupName: 'ResolverSecurityGroup',
      vpc: vpc
    });
    resolverSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), 'All');
    resolverSG.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), 'All');

    const resolver = new r53resolver.CfnResolverEndpoint(this, 'InboundResolver', {
      direction: 'INBOUND',
      ipAddresses: [
        {
          subnetId: vpc.privateSubnets[0].subnetId
        },
        {
          subnetId: vpc.privateSubnets[1].subnetId
        }
      ],
      securityGroupIds: [
        resolverSG.securityGroupId
      ],
      name: 'Inbound 7layerburrito resolver'    
    });

    const resolverIps = new CustomResolverIpResource(
      this,
      "ResolverIps",
      {
        resolverId: resolver.attrResolverEndpointId
      }
    );

    /**
     * AWS client vpn endpoint
     */
    const ep = new ec2.CfnClientVpnEndpoint(this, 'VpcEndpoint', {
      authenticationOptions: [
        {
          type: 'certificate-authentication',
          mutualAuthentication: {
            clientRootCertificateChainArn: certArn,
          }
        }
      ],
      dnsServers: [
        resolverIps.ipAddress1,
        resolverIps.ipAddress2
      ],      
      clientCidrBlock: '10.0.252.0/22',
      connectionLogOptions: {
        enabled: false
      },
      serverCertificateArn: certArn,
      splitTunnel: true
    });
    ep.node.addDependency(resolver)

    /**
     * Target Network Association and Route
     * associate to private subnet and have a route to 0.0.0.0/0 
     * if you are routing to public internet via the VPN otherwise select the isolated one
     */

    /**
     * will route to the VPC subnets only
     */
    new ec2.CfnClientVpnTargetNetworkAssociation(this, 'Asso', {
      clientVpnEndpointId: ep.ref,
      subnetId: vpc.isolatedSubnets[0].subnetId
    })

    new ec2.CfnClientVpnAuthorizationRule(this, 'Authz', {
      clientVpnEndpointId: ep.ref,
      targetNetworkCidr: vpc.vpcCidrBlock,
      authorizeAllGroups: true,
    })
  }
}
