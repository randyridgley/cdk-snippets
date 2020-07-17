import sys
import cfnresponse
import boto3
from botocore.exceptions import ClientError
import json
import logging as log


def handler(event, context):

    log.getLogger().setLevel(log.INFO)
    responseData = {}

    try:
        log.info('Received event: {}'.format(json.dumps(event)))
        result = cfnresponse.FAILED
        r53resolver = boto3.client('route53resolver')

        resolverId = event['ResourceProperties']['ResolverId']
        resourceId = event.setdefault('PhysicalResourceId', '')

        if event['RequestType'] == 'Create':
            response = r53resolver.list_resolver_endpoint_ip_addresses(
                ResolverEndpointId=resolverId
            )

            i = 1 # lazy hack
            for ipAddress in response['IpAddresses']:
                responseData['IpAddress' + str(i)] = ipAddress['Ip']
                i = i + 1

            result = cfnresponse.SUCCESS
        elif event['RequestType'] == 'Update':
            log.info('Updating resource: %s' % resourceId)
            result = cfnresponse.SUCCESS
        elif event['RequestType'] == 'Delete':
            log.info('Deleting resource: %s' % resourceId)
            result = cfnresponse.SUCCESS
    except ClientError as e:
        log.error('Error: {}'.format(e))
        result = cfnresponse.FAILED

    log.info('Returning response of: {}, with result of: {}'.format(
        result, responseData))
    sys.stdout.flush()
    cfnresponse.send(event, context, result, responseData, physicalResourceId=resourceId)