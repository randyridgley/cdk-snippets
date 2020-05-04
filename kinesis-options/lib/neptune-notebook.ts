import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2')
import neptune = require('@aws-cdk/aws-neptune')

export interface NeptuneProps {
  vpc: ec2.Vpc,
}

export class NeptuneNotebooks extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: NeptuneProps) {
    super(scope, id);

    const subnetIds: string[] = [];
    props.vpc.publicSubnets.forEach((subnet) => {
      subnetIds.push(subnet.subnetId);
    });

    const neptuneSubnetGroupName = 'path-cluster-subnet-group';

    const neptuneSubnetGroup = new neptune.CfnDBSubnetGroup(this, 'NeptuneDBSubnetGroup', {
      dbSubnetGroupDescription: 'Neptune DB subnet group',
      subnetIds: subnetIds,
      dbSubnetGroupName: neptuneSubnetGroupName
    });

    const dbClusterParameterGroup = new neptune.CfnDBClusterParameterGroup(this, 'NeptuneDBClusterParameterGroup', {
      family: 'neptune1',
      parameters: {
        'neptune_enable_audit_log': 0
      },
      description: 'test-cfn-neptune-db-cluster-parameter-group-description'
    });
    
    const neptuneSecurityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    })

    const neptunePort = 8182;
    neptuneSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    neptuneSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(neptunePort));

    const dbParameterGroup = new neptune.CfnDBParameterGroup(this, 'NeptuneDBParameterGroup', {
      family: 'neptune1',
      parameters: {
        'neptune_query_timeout': 20000
      },
      description: 'neptune-db-parameter-group-description',
    });

    const neptuneClusterName = 'path-cluster';

    const neptuneCluster = new neptune.CfnDBCluster(this, 'NeptuneDBCluster', {
      dbSubnetGroupName: neptuneSubnetGroup.dbSubnetGroupName,
      vpcSecurityGroupIds: [
        neptuneSecurityGroup.securityGroupName
      ],      
      dbClusterParameterGroupName: dbClusterParameterGroup.name,
      port: neptunePort,
      iamAuthEnabled: false,
      dbClusterIdentifier: neptuneClusterName
    });

    const neptuneInstance = new neptune.CfnDBInstance(this, 'NeptuneInstance', {
      dbInstanceClass: 'db.r5.large',
      dbClusterIdentifier: neptuneClusterName,
      dbParameterGroupName: dbParameterGroup.name,
      dbSubnetGroupName: neptuneSubnetGroupName
    });
    
    neptuneInstance.addDependsOn(neptuneCluster);
    neptuneInstance.addDependsOn(neptuneSubnetGroup);
  }
}