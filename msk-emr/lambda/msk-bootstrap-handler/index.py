import os
import json
import boto3
import traceback
import cfnresponse

def handler(event, context):
    cluster_arn = event["ResourceProperties"]["MskArn"]

    try:
        if event['RequestType'] == 'Create':
            print("get bootstrap brokers: " + cluster_arn)
            
            response = boto3.client('kafka').get_bootstrap_brokers(
                ClusterArn=cluster_arn
            )
            
            print(response)
            boostrap_brokers_tls = response["BootstrapBrokerStringTls"]
            print("BootstrapBrokerStringTls", boostrap_brokers_tls)
            bootstrap_brokers = response["BootstrapBrokerString"]
            print("Bootstrap Brokers:", bootstrap_brokers)
            
            data = {
                'BootstrapBrokers': bootstrap_brokers,
                'BootstrapBrokerStringTls': boostrap_brokers_tls
            }
            cfnresponse.send(event, context, cfnresponse.SUCCESS, data)
    except Exception:
        traceback.print_exc()
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {}})
        return {}