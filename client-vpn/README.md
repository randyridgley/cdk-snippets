# Welcome to your CDK TypeScript project!

Modify the `DOMAIN` in the `generate-keys.sh` script.
Run the `generate-keys.sh` script to geenrate the required certificates needed to connect Client VPN with mutual authentication.
Update the `certArn` in the `client-vpn-stack.ts` then you can deploy with the commands below.

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
