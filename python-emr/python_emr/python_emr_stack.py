from aws_cdk import (
    core,
    aws_s3 as s3,
    aws_iam as iam,
    aws_emr as emr,
    aws_ec2 as ec2
)


class PythonEmrStack(core.Stack):

    def __init__(self, scope: core.Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        vpc = ec2.Vpc(self, "VPC")

        sg = ec2.SecurityGroup(
            self,
            id="sg_ssh",
            vpc=vpc,            
            security_group_name="sg_ssh"
        )

        sg.add_ingress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(22)
        )

        s3_bucket = s3.Bucket(
            self, "Bucket",
            bucket_name=f"emr-example-bucket",
            versioned=False,
            removal_policy=core.RemovalPolicy.DESTROY  # NOT recommended for production code
        )

        role = iam.Role(
            self,
            "EMRJobFlowRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AmazonElasticMapReduceforEC2Role")]
        )

        profile = iam.CfnInstanceProfile(
            self, 'InstanceProfile',
            roles=[
                role.role_name
            ]
        )

        emr_cluster = emr.CfnCluster(
            self, "EMRCluster",
            name="SparkStreamingCluster",
            instances=emr.CfnCluster.JobFlowInstancesConfigProperty(
                master_instance_group=emr.CfnCluster.InstanceGroupConfigProperty(
                    instance_count=1,
                    instance_type='c5.xlarge',
                    name='Master'
                ),
                core_instance_group=emr.CfnCluster.InstanceGroupConfigProperty(
                    instance_count=2,
                    instance_type='r5.xlarge',
                    name='Core'
                ),
                ec2_key_name="<ssh_key>",
                additional_master_security_groups=[
                    sg.security_group_name
                ],
                ec2_subnet_id=vpc.public_subnets[0].subnet_id
            ),
            job_flow_role=profile.ref,
            service_role='EMR_DefaultRole',
            release_label='emr-5.29.0',
            applications=[
                emr.CfnCluster.ApplicationProperty(
                    name='Spark'
                ),
                emr.CfnCluster.ApplicationProperty(
                    name='Ganglia'
                ),
                emr.CfnCluster.ApplicationProperty(
                    name='Hive'
                ),
                emr.CfnCluster.ApplicationProperty(
                    name='Livy'
                )
            ],
            configurations=[
                emr.CfnCluster.ConfigurationProperty(
                    classification='emrfs-site',
                    configuration_properties= {
                        "fs.s3.maxConnections": "1000"
                    }
                ),
                emr.CfnCluster.ConfigurationProperty(
                    classification='hive-site',
                    configuration_properties={
                        "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
                    }
                ),
                emr.CfnCluster.ConfigurationProperty(
                    classification="spark-hive-site",
                    configuration_properties={
                        "hive.metastore.client.factory.class": "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory"
                    }
                ),
                emr.CfnCluster.ConfigurationProperty(
                    classification="spark-defaults",
                    configuration_properties={
                        "spark.dynamicAllocation.enabled": "false",
                        "spark.executor.cores": "2",
                        "spark.executor.memory": "3g",
                        "spark.executor.instances": "16"
                    }
                ),
                emr.CfnCluster.ConfigurationProperty(
                    classification="core-site",
                    configuration_properties={
                        "hadoop.proxyuser.livy.groups": "*",
                        "hadoop.proxyuser.livy.hosts": "*"
                    }
                ),
                emr.CfnCluster.ConfigurationProperty(
                    classification="livy-conf",
                    configuration_properties={
                        "livy.impersonation.enabled": "true"
                    }
                )
            ],
            log_uri='s3://' + s3_bucket.bucket_name + '/emr-logs',
        )
