# Welcome to your CDK TypeScript project!

Global Accelerator (GA) project deploying ECS clusters in Oregon and N. Virginia and register the GA with a R53 Hosted Zone to have a customer CNAME for the GA DnsName provided. You could also change to an A record with the 2 static IPs provided by GA.

In order to run the demo first execute the instructions below:

### This will create the Route 53 subdomain from an existing domain

``` bash
export MYSUBDOMAIN=<6 character sub domain>
cdk deploy hostedZone
```

### Create the Global Accelerator

Modify your `cdk.json` file to add the `hostedZoneId` and `hostedZoneName` from the deployment above 

``` bash
cdk deploy GlobalAcceleratorStack
```

### Deploy regional infrastructure

``` bash
cdk deploy West2RegionServiceStack East1RegionServiceStack
```

At this point, you should be able to hit the GA from the CNAME created in Route 53.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
