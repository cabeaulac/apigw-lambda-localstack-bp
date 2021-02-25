require('dotenv').config();
import * as aws from "@pulumi/aws";
import { RestApiArgs } from "@pulumi/aws/apigateway";
import { CustomResourceOptions } from "@pulumi/pulumi";


// Using AWS Javascript V2 API. V3 not working with custom endpoint configuration
const SecretsManager = require("aws-sdk/clients/secretsmanager");
// const {
//     SecretsManager,
//     SecretsManagerClient,
//     GetSecretValueCommand,
// } = require("@aws-sdk/client-secrets-manager");



export class AwsUtil {
    static region: any;
    static endpoint: string;

    public static async getSecretValue(secretId: string) {
        let smcParams: Object;
        // The secret to retrieve
        const params = {
            SecretId: secretId,
        };
        // Set endpoint. We pass in a specialized endpoint for localstack to run locally
        if (AwsUtil.endpoint == null && AwsUtil.region != null) {
            console.log("Set region with no endpoint");
            smcParams = { region: AwsUtil.region };
        }
        else {
            smcParams = { region: AwsUtil.region, endpoint: AwsUtil.endpoint, accessKeyId: "test", secretAccessKey: "test" }
            console.log("Set region with endpoint " + JSON.stringify(smcParams));
        }

        // Create SES service object
        const secretsManagerClient = new SecretsManager(smcParams);

        // const secretsManagerClient = new SecretsManagerClient(smcParams);
        let data;
        try {
            // data = await secretsManagerClient.getSecretValue(new GetSecretValueCommand(params));
            data = await secretsManagerClient.getSecretValue(params).promise();
            console.log("data", data);
        } catch (err) {
            console.log("err", err);
        }
        let secret;
        if ("SecretString" in data) {
            secret = data.SecretString;
        } else {
            console.log("else:", data);

            // Create a buffer
            const buff = new Buffer(data.SecretBinary, "base64");
            secret = buff.toString("ascii");
        }
        return secret;
    }
}

