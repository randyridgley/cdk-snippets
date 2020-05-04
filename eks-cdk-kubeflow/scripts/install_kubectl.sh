#!/bin/bash

echo "Downloading kubectl"
curl -o kubectl https://amazon-eks.s3-us-west-2.amazonaws.com/1.14.6/2019-08-22/bin/linux/amd64/kubectl

echo "chmod +x ./kubectl"
chmod +x ./kubectl

echo "Placing kubectl in local bin path and adding to profile"
mkdir -p $HOME/bin && cp ./kubectl $HOME/bin/kubectl && export PATH=$HOME/bin:$PATH
echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

echo "Verifying installation of kubectl"
kubectl version --short --client

echo "Downloading aws-iam-authenticator"
curl -o aws-iam-authenticator https://amazon-eks.s3-us-west-2.amazonaws.com/1.14.6/2019-08-22/bin/linux/amd64/aws-iam-authenticator

echo "chmod +x ./aws-iam-authenticator"
chmod +x ./aws-iam-authenticator

echo "Placing aws-iam-authenticator in local bin path"
mkdir -p $HOME/bin && cp ./aws-iam-authenticator $HOME/bin/aws-iam-authenticator && export PATH=$HOME/bin:$PATH

echo "running aws-iam-authenticator help"
aws-iam-authenticator help

echo "sudo yum install jq -y"
sudo yum install jq gettext bash-completion -y 

for command in kubectl jq envsubst
  do
    which $command &>/dev/null && echo "$command in path" || echo "$command NOT FOUND"
  done

kubectl completion bash >>  ~/.bash_completion
. /etc/profile.d/bash_completion.sh
. ~/.bash_completion