#  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#  Permission is hereby granted, free of charge, to any person obtaining a copy of
#  this software and associated documentation files (the "Software"), to deal in
#  the Software without restriction, including without limitation the rights to
#  use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
#  the Software, and to permit persons to whom the Software is furnished to do so.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
#  FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
#  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
#  IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
#  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

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
        resourceId = event.setdefault('PhysicalResourceId', '')
        kvs = boto3.client('kinesisvideo')
        stream_name = event['ResourceProperties']['StreamName']
        kms_key_id = event['ResourceProperties']['KmsKeyId']

        if event['RequestType'] == 'Create':
            kvs.create_stream(
                StreamName=stream_name,
                KmsKeyId=kms_key_id,
            )
            result = cfnresponse.SUCCESS
        elif event['RequestType'] == 'Update':
            log.info('Updating video stream: %s' % resourceId)
            result = cfnresponse.SUCCESS
        elif event['RequestType'] == 'Delete':
            kvs_arn = kvs.describe_stream(StreamName=stream_name)['StreamInfo']['StreamARN']
            kvs.delete_stream(StreamARN=kvs_arn)
            result = cfnresponse.SUCCESS
    except ClientError as e:
        log.error('Error: {}'.format(e))
        result = cfnresponse.FAILED

    log.info('Returning response of: {}, with result of: {}'.format(
        result, responseData))
    sys.stdout.flush()
    cfnresponse.send(event, context, result, responseData, physicalResourceId=resourceId)