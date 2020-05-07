const aws = require('aws-sdk');
const sqs = new aws.SQS();

exports.handler = async (event:any) => {
    console.log("request:", JSON.stringify(event, undefined, 2));
    
    const params = {
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: event.Records[0].Sns.Message        
    };

    console.log(event.Records[0].Sns.Message);
    await sqs.sendMessage(params).promise();

    return {
        statusCode: 200,
        body: `hi, Successfully pushed your message to ${process.env.QUEUE_URL}!!`
    }
}