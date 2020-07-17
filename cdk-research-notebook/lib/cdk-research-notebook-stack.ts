import cdk = require('@aws-cdk/core');
import { SageMakerNotebook } from './constructs/notebook';

export class CdkResearchNotebookStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new SageMakerNotebook(this, 'sagemaker-notebook', {
      notebookName: 'cdk-research-notebook',
      notebookInstanceType: 'ml.t2.medium',
      onCreateScriptPath: 'scripts/onCreate.sh',
      onStartScriptPath: 'scripts/onStart.sh'
    })
  }
}
