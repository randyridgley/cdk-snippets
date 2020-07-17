from __future__ import print_function
import base64
import json
import boto3
import os
from botocore.exceptions import ClientError

#Lambda function is written based on output from an Amazon SageMaker example: 
#https://github.com/awslabs/amazon-sagemaker-examples/blob/master/introduction_to_amazon_algorithms/object_detection_pascalvoc_coco/object_detection_image_json_format.ipynb
object_categories = ['person', 'bicycle', 'car',  'motorbike', 'aeroplane', 'bus', 'train', 'truck', 'boat', 
                     'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
                     'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag',
                     'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat',
                     'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
                     'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot',
                     'hot dog', 'pizza', 'donut', 'cake', 'chair', 'sofa', 'pottedplant', 'bed', 'diningtable',
                     'toilet', 'tvmonitor', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
                     'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
                     'toothbrush']
threshold = 0.15

def lambda_handler(event, context):
  for record in event['Records']:
    payload = base64.b64decode(record['kinesis']['data'])
    #Get Json format of Kinesis Data Stream Output
    result = json.loads(payload)
    #Get FragmentMetaData
    fragment = result['fragmentMetaData']
    print("fragment: " + fragment)
    #Get FrameMetaData
    frame = result['frameMetaData']
    print("frame: " + frame)
    #Get StreamName
    streamName = result['streamName']
    print("streamName: " + streamName)
    #Get SageMaker response in Json format
    sageMakerOutput = json.loads(base64.b64decode(result['sageMakerOutput']))
    print("sagemaker raw output: " + str(sageMakerOutput))
    
    #Print different detected objects with highest probability
    predictedList = sageMakerOutput['prediction']
    foundObjects = set(map(lambda x:x[0], predictedList))
    for foundObject in foundObjects:
      filtered = [x[0:2] for x in predictedList if x[0]==foundObject and x[1] > threshold]
      if len(filtered) > 0:
        highestConfidenceDetection = max(filtered, key = lambda y:y[1])
        print("detected object: " + object_categories[int(highestConfidenceDetection[0])] + ", with confidence: " + str(highestConfidenceDetection[1]))
  return 'Successfully processed {} records.'.format(len(event['Records']))
