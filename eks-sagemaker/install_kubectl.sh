#!/bin/bash

usage() { echo "Usage: $0 [-c <cluster>] [-r <region>]" 1>&2; }

OPTS=`getopt -o hcr: --long cluster,region,help -a -- "$@"`

if [ $? != 0 ] ; then echo "Failed parsing options." >&2 ; exit 1 ; fi

eval set -- "$OPTS"

CLUSTER_NAME=""
AWS_REGION=""

while true; do
  case "$1" in
    -h|--help) 
    usage
    exit 0
    ;;
    -c | --cluster ) CLUSTER_NAME="$2"; shift ;;
    -r | --region ) AWS_REGION="$2"; shift ;;
  esac
done

echo CLUSTER_NAME=$CLUSTER_NAME
echo AWS_REGION=$AWS_REGION

# parse_commandline()
# {
# 	while test $# -gt 0
# 	do
# 		_key="$1"
# 		case "$_key" in
# 			-c|--cluster)
# 				test $# -lt 2 && die "Missing value for EKS Cluster ARN '$_key'." 1
# 				CLUSTER_NAME="$2"
# 				shift
# 				;;
# 			--cluster=*)
# 				CLUSTER_NAME="${_key##--cluster=}"
# 				;;
# 			-c*)
# 				CLUSTER_NAME="${_key##-c}"
# 				;;
# 			-r|--region)
# 				test $# -lt 2 && die "Missing value for AWS Region '$_key'." 1
# 				AWS_REGION="$2"
# 				shift
# 				;;
# 			--region=*)
# 				AWS_REGION="${_key##--region=}"
# 				;;
# 			-r*)
# 				AWS_REGION="${_key##-r}"
# 				;;
# 			-h|--help)
# 				print_help
# 				exit 0
# 				;;
# 			-h*)
# 				print_help
# 				exit 0
# 				;;
# 			*)
# 				_PRINT_HELP=yes die "FATAL ERROR: Got an unexpected argument '$1'" 1
# 				;;
# 		esac
# 		shift
# 	done
# }

# if [[ $# -eq 0 ]] ; then
#   die
# fi

# parse_commandline "$@"
echo "Value of --cluster: $CLUSTER_NAME"
echo "Value of --region: $AWS_REGION"

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


curl --silent --location "https://github.com/weaveworks/eksctl/releases/download/latest_release/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp

sudo mv -v /tmp/eksctl /usr/local/bin

eksctl completion bash >> ~/.bash_completion
. /etc/profile.d/bash_completion.sh
. ~/.bash_completion

eksctl utils associate-iam-oidc-provider --cluster $CLUSTER_NAME \
	--region $AWS_REGION --approve

aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
	--query cluster.identity.oidc.issuer --output text