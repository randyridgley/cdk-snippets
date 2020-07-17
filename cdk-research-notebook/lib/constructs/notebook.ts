import cdk = require('@aws-cdk/core');
import iam = require('@aws-cdk/aws-iam');
import sagemaker = require('@aws-cdk/aws-sagemaker');
import fs = require('fs');
import { ManagedPolicy } from '@aws-cdk/aws-iam';

export interface SageMakerNotebookProps {
    notebookName: string;
    notebookInstanceType: string;
    onCreateScriptPath: string;
    onStartScriptPath: string;
}

export class SageMakerNotebook extends cdk.Construct {
    constructor(parent: cdk.Construct, id: string, props: SageMakerNotebookProps) {
        super(parent, id);

        let onStartScript = fs.readFileSync(props.onStartScriptPath, 'utf8');
        let onCreateScript = fs.readFileSync(props.onCreateScriptPath, 'utf8');

        /** Create the IAM Role to be used by SageMaker */
        const role = new iam.Role(this, 'notebook-role', {
            assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('IAMReadOnlyAccess')
            ]            
        });

        /** Create the SageMaker Notebook Lifecycle Config */
        const lifecycleConfig = new sagemaker.CfnNotebookInstanceLifecycleConfig(
            this, 'lifecycle-config', {
                notebookInstanceLifecycleConfigName: `${props.notebookName}-lifecycle-config`,
                onCreate: [
                    {
                        content: cdk.Fn.base64(onCreateScript!)
                    }
                ],
                onStart: [
                    {
                        content: cdk.Fn.base64(onStartScript!)
                    }
                ]
            });

        /** Create the SageMaker notebook instance */
        const notebook = new sagemaker.CfnNotebookInstance(this, 'sagemaker-notebook', {
            notebookInstanceName: props.notebookName,
            lifecycleConfigName: lifecycleConfig.notebookInstanceLifecycleConfigName,
            roleArn: role.roleArn,
            instanceType: props.notebookInstanceType
        });

    }
}