#!/usr/bin/env python3

from aws_cdk import core

from python_emr.python_emr_stack import PythonEmrStack


app = core.App()
PythonEmrStack(app, "python-emr")

app.synth()
