#!/bin/bash
set -e
sudo -i -u ec2-user bash << EOF
echo "Setup the Workshop exercises"
git clone https://github.com/aws-samples/aws-research-workshops ~/SageMaker/aws-research-workshops/