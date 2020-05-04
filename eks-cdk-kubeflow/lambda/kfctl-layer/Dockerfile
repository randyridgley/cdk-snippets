FROM amazonlinux:latest as builder

WORKDIR /root

RUN yum update -y && yum install -y unzip make wget tar gzip

# download kfctl
ADD https://github.com/kubeflow/kubeflow/releases/download/v0.7.0/kfctl_v0.7.0_linux.tar.gz /tmp/
RUN mkdir -p /opt/kfctl && tar xzf /tmp/kfctl_v0.7.0_linux.tar.gz -C /opt/kfctl && chmod +x /opt/kfctl/kfctl

# download aws-iam-authenticator
ADD https://amazon-eks.s3-us-west-2.amazonaws.com/1.14.6/2019-08-22/bin/linux/amd64/aws-iam-authenticator /opt/aws-iam-authenticator/
RUN chmod +x /opt/aws-iam-authenticator/aws-iam-authenticator

# download eksctl
ADD https://github.com/weaveworks/eksctl/releases/download/latest_release/eksctl_Linux_amd64.tar.gz /tmp/
RUN mkdir -p /opt/eksctl && tar xzf /tmp/eksctl_Linux_amd64.tar.gz -C /opt/eksctl && chmod +x /opt/eksctl/eksctl

#
# prepare the runtime at /opt/kubectl
#
  
FROM lambci/lambda:provided as runtime

USER root

RUN yum install -y zip unzip

#
# kfctl
#
COPY --from=builder /opt/kfctl/kfctl /tmp/cli/kfctl

#
# aws-iam-authenticator
#
COPY --from=builder /opt/aws-iam-authenticator/aws-iam-authenticator /tmp/cli/aws-iam-authenticator

#
# eksctl
#
COPY --from=builder /opt/eksctl/eksctl /tmp/cli/eksctl


# wrap it up
RUN cd /tmp/cli; tar zcf /opt/cli.tar.gz *; cd /opt; zip -r ../layer.zip *;  \
echo "/layer.zip is ready"; \
unzip -l /layer.zip; \
ls -alh /layer.zip;