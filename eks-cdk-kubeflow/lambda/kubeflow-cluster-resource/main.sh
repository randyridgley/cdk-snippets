#!/bin/bash
#set -euo pipefail

#
# Your business logic starts here
#
StackId=$(echo $1 | jq -r '.StackId | select(type == "string")')
ResponseURL=$(echo $1 | jq -r '.ResponseURL | select(type == "string")')
RequestType=$(echo $1 | jq -r '.RequestType | select(type == "string")')
RequestId=$(echo $1 | jq -r '.RequestId | select(type == "string")')
ServiceToken=$(echo $1 | jq -r '.ServiceToken | select(type == "string")')
LogicalResourceId=$(echo $1 | jq -r '.LogicalResourceId | select(type == "string")')

#
# get the specific parameters for the cluster
#
ClusterName=$(echo $1 | jq -r '.ResourceProperties.ClusterName | select(type == "string")')
KubeflowConfigUrl=$(echo $1 | jq -r '.ResourceProperties.KubeflowConfigUrl | select(type == "string")')
KubeflowStagingS3Bucket=$(echo $1 | jq -r '.ResourceProperties.KubeflowStagingS3Bucket | select(type == "string")')
InstanceIamRoleArn=$(echo $1 | jq -r '.ResourceProperties.InstanceIamRoleArn | select(type == "string")')
AdminIamRoleArn=$(echo $1 | jq -r '.ResourceProperties.AdminIamRoleArn | select(type == "string")')

echo "Kubeflow Config URL is : ${KubeflowConfigUrl}"
echo "Kubeflow Staging S3 Bucket is : ${KubeflowStagingS3Bucket}"
echo "Cluster name is : ${ClusterName}"
echo "Region is : ${region}"
echo "Admin IAM Role Arn is : ${AdminIamRoleArn}"
echo "Instance IAM Role Arn is : ${InstanceIamRoleArn}"

export KUBECONFIG=/tmp/kubeconfig

update_kubeconfig(){
    echo "Retrieving kubeconfig details and saving to ${KUBECONFIG} with role arn: ${AdminIamRoleArn}"
    aws eks update-kubeconfig --name "${ClusterName}" --kubeconfig "${KUBECONFIG}" --region "${region}" --role-arn "${AdminIamRoleArn}"
}

update_kubeconfig

# set the Kubeflow Config dir
KFCONFIG=/tmp/kubeflow
if [ ! -d ${KFCONFIG} ]; then mkdir -p ${KFCONFIG}; fi

CONFIG_FILE="${KFCONFIG}/${KubeflowConfigUrl##*/}"
echo "Kubeflow config file is: ${CONFIG_FILE}"

KF_STAGING_CONFIG_URL="s3://${KubeflowStagingS3Bucket}/${ClusterName}/${KubeflowConfigUrl##*/}"
echo "Kubeflow staging URL is: ${KF_STAGING_CONFIG_URL}"

sendResponseCurl(){
  # Usage: sendRespose body_file_name url
  curl -s -XPUT \
  -H "Content-Type: " \
  -d @$1 $2
}

kubeflow_install(){

  curl -o aws-iam-authenticator https://amazon-eks.s3-us-west-2.amazonaws.com/1.13.7/2019-06-11/bin/linux/amd64/aws-iam-authenticator
  chmod +x aws-iam-authenticator
  sudo mv aws-iam-authenticator /usr/local/bin

  # setup the kubeflow config
  cd ${KFCONFIG}
  rm -rf *
  echo "Running kfctl build command with URL: ${KubeflowConfigUrl}"
  kfctl build -V -f ${KubeflowConfigUrl}

  # update config with correct cluster name, IAM role and region params
  echo "Replacing Instance IAM role [${InstanceIamRoleArn##*/}], region [${region}] and cluster name [$ClusterName] params"
  sed -i'.bak' -e 's/eksctl-kubeflow-aws-nodegroup[^ ]*/'"${InstanceIamRoleArn##*/}"'/; s/us-west-2/'"${region}"'/; s/kubeflow-aws/'"${ClusterName}"'/;' ${CONFIG_FILE}

  # remove the kustomize folder
  echo "Removing kustomize folder"
  rm -rf kustomize/

  # setup kubeflow on cluster
  echo "Running kfctl apply command"
  kfctl apply -V -f ${CONFIG_FILE}

  # upload config to S3
  echo "Copying config file ${CONFIG_FILE} to S3 location: ${KF_STAGING_CONFIG_URL}"
  aws s3 cp ${CONFIG_FILE} ${KF_STAGING_CONFIG_URL}
}

# downlod the KF config file if exists
download_kf_config(){
    echo "Checking if KubeFlow config file: ${KF_STAGING_CONFIG_URL} exists"
    aws s3 ls ${KF_STAGING_CONFIG_URL} || not_exist=true
    if [ $not_exist ]; then
      echo "KubeFlow config file does not exist in S3: ${KF_STAGING_CONFIG_URL}"
    else
      aws s3 cp ${KF_STAGING_CONFIG_URL} ${CONFIG_FILE}
      echo "Config saved from S3 bucket to ${CONFIG_FILE}"
    fi
}

kubeflow_uninstall(){
  download_kf_config

  if [ -f ${CONFIG_FILE} ]; then 
    echo "Config file exists. Uninstalling kubeflow"
    cd ${KFCONFIG}
    kfctl delete -f ${CONFIG_FILE}
  else
    echo "Config file not found"
  fi
}

sendResponseSuccess(){
  cat << EOF > /tmp/sendResponse.body.json
{
    "Status": "SUCCESS",
    "Reason": "",
    "PhysicalResourceId": "${RequestId}",
    "StackId": "${StackId}",
    "RequestId": "${RequestId}",
    "LogicalResourceId": "${LogicalResourceId}",
    "Data": {
        "Result": "OK"
    }
}
EOF
  echo "=> sending cfn custom resource callback"
  sendResponseCurl /tmp/sendResponse.body.json $ResponseURL
}

sendResponseFailed(){
  cat << EOF > /tmp/sendResponse.body.json
{
    "Status": "FAILED",
    "Reason": "",
    "PhysicalResourceId": "${RequestId}",
    "StackId": "${StackId}",
    "RequestId": "${RequestId}",
    "LogicalResourceId": "${LogicalResourceId}",
    "Data": {
        "Result": "OK"
    }
}
EOF
  echo "sending callback to $ResponseURL"
  sendResponseCurl /tmp/sendResponse.body.json $ResponseURL
}


case $RequestType in 
  "Create")
    kubeflow_install
    sendResponseSuccess
  ;;
  "Delete")
    kubeflow_uninstall
    sendResponseSuccess
  ;;
  *)
    sendResponseSuccess
  ;;
esac


exit 0
