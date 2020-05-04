#!/bin/bash

TAG='aws-lambda-layer-kfctl'
LAYER_ZIP='layer.zip'

# build the files
docker build -t $TAG .
CONTAINER=$(docker run -d $TAG false)
docker cp ${CONTAINER}:/layer.zip ${LAYER_ZIP}