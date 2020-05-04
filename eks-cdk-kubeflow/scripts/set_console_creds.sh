#!/bin/bash

sudo yum install -y jq

echo "Remove existing credentials"
rm -vf ${HOME}/.aws/credentials

echo "Get credentials from STS"
export ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')

test -n "$AWS_REGION" && echo AWS_REGION is "$AWS_REGION" || echo AWS_REGION is not set

echo "Update base_profile"
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile

echo "Configure AWS CLI"
aws configure set default.region ${AWS_REGION}
aws configure get default.region

aws sts get-caller-identity | jq -r '.Arn'