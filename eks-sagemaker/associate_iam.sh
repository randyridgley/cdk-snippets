#!/bin/sh

CLUSTER_NAME=$1
AWS_REGION=$2

eksctl utils associate-iam-oidc-provider --cluster $CLUSTER_NAME \
	--region $AWS_REGION --approve

aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
	--query cluster.identity.oidc.issuer --output text