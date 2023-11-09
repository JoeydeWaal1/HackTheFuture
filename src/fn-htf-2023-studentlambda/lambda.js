const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { ComprehendClient, DetectDominantLanguageCommand } = require('@aws-sdk/client-comprehend');
const { DynamoDBClient, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const axios = require('axios');
const AWSXRay = require('aws-xray-sdk-core');
const AWS = require('aws-sdk')
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.captureHTTPsGlobal(require('https'));

// Constants from environment variables
const teamName = process.env.TeamName;
const eventBusName = process.env.EventBusName;
const dynamoDBTable = process.env.DynamoDBName;
const sqsUrl = process.env.SQSUrl;
const clickupCliendID = process.env.ClickupEndpoint;
const clickupClientSecret = process.env.ClickupApiKey;
const discordUrl = process.env.DiscordUrl;


lamda_main = async (event) => {
    // decrypt msg`
    let decrypted_message = await decrypt(event["detail"]["Message"]);

    // translate
    let language = await checkLanguage(decrypted_message);
    let vertaaldeMessage = await translateToEnglish(decrypted_message, language);
    console.log(`vertaald: ${vertaaldeMessage}`);
    let sms = await sendSMS(decrypted_message)
    

    // door sturen
    checkLocation(event["detail"]["Location"],decrypted_message);
}

//lamda_main(EVENT);
exports.handler = lamda_main;

async function sendToSendGrid (message) {
    console.log(message);
}

async function sendToDiscord (message) {
    console.log("send to discord");
    console.log(message);
    const discordWebUrl = discordUrl

    const discordParams = {
        content: message,
    };
    
    try {
        const response = await axios.post(discordWebUrl, discordParams);
        console.log(`Translated message sent to Discord: ${JSON.stringify(response.data)}`);
    }     catch (error) {
        console.error(`Error sending translated message to Discord: ${error.message}`);
        throw error;
    }
 
}
async function checkLocation(location, message){
    console.log("sending to:",location);
    switch (location.toLowerCase()){
        case "sqs":
            await sendToSQS(message);
            break;
        case "discord":
            await sendToDiscord(message);
            break;
        case "clickup":
            break;
        case "send mail":
            break;
        case "sms":
            await sendSMS(message);
            break;
        default:
            console.log("doing nothing");
            break;
    }
}
async function sendToSQS (message) {
    console.log("sending to sqs");
    let client = new SQSClient();
    const input = {
        QueueUrl: sqsUrl,
        MessageBody: message
    }
    let msg = new SendMessageCommand(input);
    await client.send(msg);
}
// sendToClickup("test");

async function sendToClickup (message) {
    // console.log(message, "sending to click up");
    // let response = axios.post("https://api.clickup.com/api/v2/oauth/token", null, {
    //     params: {
    //         code: "test",
    //         // client_id: clickupCliendID,
    //         // client_secret: clickupClientSecret
    //         client_id: "WCV2QG06A61WS9QGQQARD3DZDZWXJ421",
    //         client_secret: "7J1IKILJ7BFNI2ZV85QDOGLOANN7STRGSWMBXCEMMSSQRL8WMDEN682WMJSV6ZKM"
    //     }
    // });
    // console.log(response.data)
}

async function sendSMS (message) {
    var SNS = new AWS.SNS()

    var params = {

        TopicArn: "arn:aws:sns:eu-central-1:128894441789:CyberSnakes-SNS",
        Message: message
    }
    SNS.publish(params, function(err, data) {
        if (err) {
            console.log(err)
            reject(err)
        } else {
            console.log(data)
            resolve(data)
        }
    })
}

async function alfabet() {
    const client = new DynamoDBClient({region: "eu-central-1"});
    var params = {
        TableName: dynamoDBTable
      };

    const command = new ScanCommand(params);
    const response = await client.send(command);

    var data = {}; // (a, c)
    for (const d of response["Items"]){
        let a = d["alphabet"]["S"];
        let c = d["cipher"]["S"];
        data[a] = c;
    }
    return data;
}

async function decrypt (message) {
    let letters = message.toLowerCase();
    let zin = "";
    let data = await alfabet();
    for (const letter of letters){
        const d_letter = data[letter];
        zin += d_letter || " ";
    }
    return zin;
}

async function translateToEnglish (message, sourceLanguage) {
    let params = {
        Text: message, 
        SourceLanguageCode: sourceLanguage, 
        TargetLanguageCode: "en"
    }
    let transClient = new TranslateClient()
    let command = new TranslateTextCommand(params)
    let response = await transClient.send(command)
    return response["TranslatedText"];
}

async function checkLanguage (message) {
    let comprehendClient = new ComprehendClient()
    let command = new DetectDominantLanguageCommand({Text: message})
    let response = await comprehendClient.send(command)
    return response["Languages"][0]["LanguageCode"]
}