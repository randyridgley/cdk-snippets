import cdk = require('@aws-cdk/core');

import { Vpc } from '@aws-cdk/aws-ec2';
import ecs = require("@aws-cdk/aws-ecs");
import ecsPatterns = require("@aws-cdk/aws-ecs-patterns");

export interface ECSProps {
  readonly vpc: Vpc;
  mskBootstrapBrokers: string
}

export class ECSKafkaUtilsCluster extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ECSProps) {
    super(scope, id);

    const ecsCluster = new ecs.Cluster(this, "Cluster", {
      clusterName: "kafka-utils-cluster",
      vpc: props.vpc
    });

    const schemaRegistry = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaSchemaRegistryService", {
      cluster: ecsCluster, // Required
      cpu: 256,
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("confluentinc/cp-schema-registry:5.3.0"),
        containerName: 'kafka-schema-registry',      
        environment: {
          'SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS': 'PLAINTEXT://' + props.mskBootstrapBrokers,
          'SCHEMA_REGISTRY_HOST_NAME': 'ecs-kafka-schema-registry',
          'SCHEMA_REGISTRY_LISTENERS': 'http://0.0.0.0:8081'
        },
        containerPort: 8081
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 9002,
      publicLoadBalancer: true
    });

    const scaling = schemaRegistry.service.autoScaleTaskCount({ maxCapacity: 2 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    const restService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaRestAPIService", {
      cluster: ecsCluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("confluentinc/cp-kafka-rest:latest"),
        containerName: 'kafka-rest-api',
        environment: {
          'KAFKA_REST_BOOTSTRAP_SERVERS': 'PLAINTEXT://' + props.mskBootstrapBrokers,
          'KAFKA_REST_SCHEMA_REGISTRY_URL': 'http://kafka-schema-registry.ecs.local:8081/',
          'KAFKA_REST_LISTENERS': 'http://0.0.0.0:8082',
          'KAFKA_REST_HOST_NAME': 'ecs-kafka-rest-api'
        },
        containerPort: 8082
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 9002,
      publicLoadBalancer: true
    });

    const restScaling = restService.service.autoScaleTaskCount({ maxCapacity: 2 });
    restScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    const kafkaConnectService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaConnectService", {
      cluster: ecsCluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("debezium/connect:0.9"),
        containerName: 'kafka-connect',
        environment: {
          'BOOTSTRAP_SERVERS': props.mskBootstrapBrokers,
          'GROUP_ID': 'kafka-connect-group',
          'CONFIG_STORAGE_TOPIC': 'kafka-connect-config',
          'OFFSET_STORAGE_TOPIC': 'kafka-connect-offset',
          'STATUS_STORAGE_TOPIC': 'kafka-connect-status',
          'KEY_CONVERTER': 'io.confluent.connect.avro.AvroConverter',
          'VALUE_CONVERTER': 'io.confluent.connect.avro.AvroConverter',
          'INTERNAL_KEY_CONVERTER': 'org.apache.kafka.connect.json.JsonConverter',
          'INTERNAL_VALUE_CONVERTER': 'org.apache.kafka.connect.json.JsonConverter',
          'CONNECT_KEY_CONVERTER_SCHEMA_REGISTRY_URL': 'http://kafka-schema-registry.ecs.local:8081/',
          'CONNECT_VALUE_CONVERTER_SCHEMA_REGISTRY_URL': 'http://kafka-schema-registry.ecs.local:8081/'
        },
        containerPort: 8083
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 8083,
      publicLoadBalancer: true
    });

    const kafkaConnectServiceScaling = kafkaConnectService.service.autoScaleTaskCount({ maxCapacity: 2 });
    kafkaConnectServiceScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    const kafkaConnectUIService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaConnectUIService", {
      cluster: ecsCluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("landoop/kafka-connect-ui"),
        containerName: 'kafka-connect-ui',
        environment: {
          'CONNECT_URL': 'http://kafka-connect.ecs.local:8083',
        },
        containerPort: 8083
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 9001,
      publicLoadBalancer: true
    });

    const kafkaKSQLService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaKSQLService", {
      cluster: ecsCluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("confluentinc/cp-ksql-server:5.3.1"),
        containerName: 'kafka-ksql',
        environment: {
          'KSQL_BOOTSTRAP_SERVERS': 'PLAINTEXT://' + props.mskBootstrapBrokers,
          'KSQL_KSQL_SCHEMA_REGISTRY_URL': 'http://kafka-schema-registry.ecs.local:8081/',
          'KSQL_LISTENERS': 'http://0.0.0.0:8088',
          'KSQL_KSQL_SERVICE_ID': 'ksql-server_'
        },
        containerPort: 8088
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 8088,
      publicLoadBalancer: true
    });

    const kafkaKSchemaRegistryUIervice = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "KafkaSchemaRegistryUIService", {
      cluster: ecsCluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("landoop/schema-registry-ui:0.9.4"),
        containerName: 'kafka-ksql',
        environment: {
          'SCHEMAREGISTRY_URL': 'http://kafka-schema-registry.ecs.local:8081/'
        },
        containerPort: 8000        
      },
      memoryLimitMiB: 1024, // Default is 512
      listenerPort: 9000,
      publicLoadBalancer: true
    });
  }
}
