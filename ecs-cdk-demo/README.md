# Successful Deployment of CI/CD Pipelines with Containers and CDK

This is the code for the demo of the **'Successful Deployment of CI/CD Pipelines with Containers and CDK'** session.

## Setup
To setup the demo in your environment follow these steps:

* Clone this repository to your local environment
    ```bash
    git clone https://github.com/dstroppa/ecs-cdk-demo
    ```
* Create your own sample app repository and a [Github OAuth token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line)
* Store your token in Secrets Manager
    ```bash
    aws secretsmanager create-secret --name /your/secret/github/token --secret-string '{"github-token":"MY_SECRET_TOKEN"}'
    ```
* If you haven't done it already, install CDK
    ```bash
    npm install -g aws-cdk
    ```
* From within the cdk folder, install the required npm packages
    ```bash
    cd ecs-cdk-demo/cdk
    npm install
    ```
* Modify the `ecs-cdk-demo/cdk/lib/cicd-stack.ts` and add the details of your own repo and token
    ```typescript
    // Source Action
    // NOTE: Replace 'owner' and 'oauthToken' with your own, see README.
    const sourceAction = new actions.GitHubSourceAction({
      actionName: "GitHub-Source",
      owner: "YOUR_OWN_GITHUB_ID",
      repo: "ecs-sample-app",
      branch: "master",
      oauthToken: cdk.SecretValue.secretsManager("/your/own/secret/github/token"),
      output: sourceOutput
    });
    ```
* Deploy the app
    ```bash
    cdk deploy '*'
    ```

## Cleanup
Once completed, make sure to delete the resource created with `cdk destroy '*'`.
