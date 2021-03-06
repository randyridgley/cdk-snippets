const { StepFunctions } = require('aws-sdk');
const AWS = require('aws-sdk');
export { };
AWS.config.region = process.env.AWS_REGION || 'us-east-1'

exports.handler = async function (event: any) {
  // var ecs = new ECS({ apiVersion: '2014-11-13' });
  var sfn = new StepFunctions();

  console.log("request:", JSON.stringify(event, undefined, 2));
  let records: any[] = event.Records;

  /**
   * An event can contain multiple records to process. i.e. the user could have uploaded 2 files.
   */
  for (let index in records) {
    let payload = JSON.parse(records[index].body);
    console.log('processing s3 events ' + payload);

    let s3eventRecords = JSON.parse(payload.Message);

    console.log('records ' + s3eventRecords);

    for (let i in s3eventRecords) {

      let s3event = s3eventRecords[i][0];

      //Extract variables from event
      const objectKey = s3event?.s3?.object?.key;
      const bucketName = s3event?.s3?.bucket?.name;
      const bucketARN = s3event?.s3?.bucket?.arn;

      console.log('Object Key - ' + objectKey);
      console.log('Bucket Name - ' + bucketName);
      console.log('Bucket ARN - ' + bucketARN);

      if ((typeof (objectKey) != 'undefined') &&
        (typeof (bucketName) != 'undefined') &&
        (typeof (bucketARN) != 'undefined')) {

        const result = await sfn.startExecution({
          stateMachineArn: process.env.STATE_MACHINE_ARN,
          input: JSON.stringify({
            Record: s3event
          })
        }).promise();
        console.log(`Execution ARN: ${result.executionArn}`);
        console.log(result);
      } else {
        console.log('not an s3 event...')
      }
    }
  }
};