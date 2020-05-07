# EC2 Fleet Launch Template with Private IP Address assigned

The attributes in the doc passed to the stack need to be changed below in `bin\ec2-launch-template.ts`
```json
{
    privateIpAddress: 'privateIpAddress',
    keyname: 'sshkey',
    vpcId: 'vpc-id',
    subnetId: 'subnet-id'
}
```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
