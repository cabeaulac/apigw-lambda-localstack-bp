require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
import * as aws from "@pulumi/aws";
import {AwsUtil} from "../util/aws-util"
import {PulumiUtil} from "../util/pulumi-util";
import * as dbsecret from "../db-secrets";

const STAGE: string = process.env.STAGE + "";
const REGION: string = process.env.REGION + "";
const NAME: string = process.env.APP_NAME + "";
const helloPath: string = "apath";

let apiName = "hello";

//////////////////////////
// Setup Lambda IAM role
//////////////////////////
const policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "sts:AssumeRole",
            "Principal": {
                "Service": "lambda.amazonaws.com",
            },
            "Effect": "Allow",
            "Sid": "",
        },
    ],
};

let executeApiPolicy = pulumi.interpolate`{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": [
                "execute-api:/*"
            ]
        }
    ]
}`;


////////////////////
// Create IAM Role
////////////////////
const role = new aws.iam.Role(
    `${NAME}-${apiName}`,
    { assumeRolePolicy: JSON.stringify(policy), },
    { provider: PulumiUtil.awsProvider, }
);

///////////////////////////
// Create IAM Role Policy
///////////////////////////

// Don't need policy attachment for localstack
if (!STAGE.endsWith("local")) {
    const fullAccess = new aws.iam.RolePolicyAttachment(
        `${NAME}-${apiName}`,
        {
            role: role,
            policyArn: aws.iam.ManagedPolicy.LambdaFullAccess,
        },
        { provider: PulumiUtil.awsProvider, }
    );
}
//////////////////
// Create Lambda
//////////////////
const lambdaNode = new aws.lambda.Function(
    `${NAME}-${apiName}`,
    {
        runtime: aws.lambda.NodeJS12dXRuntime,
        code: new pulumi.asset.FileArchive("./node/handler.zip"),
        timeout: 5,
        handler: "handler.handler",
        role: role.arn,
    },
    { provider: PulumiUtil.awsProvider, }
);



//////////////////////
// Create APIGATEWAY
//////////////////////
let restApi = new aws.apigateway.RestApi(
    `${NAME}-${apiName}-api`,
    {
        body: "",
        endpointConfiguration: {
            types: "REGIONAL",
        }
    },
    { provider: PulumiUtil.awsProvider, }
);

////////////////////////////
// Create RestApi Resource
////////////////////////////
const resource = new aws.apigateway.Resource(
    `${NAME}-${apiName}-base`,
    {
        restApi: restApi,
        pathPart: `${helloPath}`,
        parentId: restApi.rootResourceId,
    },
    { provider: PulumiUtil.awsProvider, }
);

//////////////////////////
// Create RestAPI Method
//////////////////////////

const method = new aws.apigateway.Method(
    `${NAME}-${apiName}-base-get`,
    {
        restApi: restApi,
        resourceId: resource.id,
        httpMethod: "GET",
        authorization: "NONE",
    },
    { provider: PulumiUtil.awsProvider, }
);

///////////////////////////////////
// Set RestApi Lambda Integration
///////////////////////////////////

const integration = new aws.apigateway.Integration(
    `${NAME}-${apiName}-base-api-integ`,
    {
        restApi: restApi,
        resourceId: resource.id,
        httpMethod: method.httpMethod,
        type: "AWS_PROXY",
        integrationHttpMethod: "POST",
        passthroughBehavior: "WHEN_NO_MATCH",
        uri: pulumi.interpolate`arn:aws:apigateway:${AwsUtil.region}:lambda:path/2015-03-31/functions/${lambdaNode.arn}/invocations`
    },
    {
        dependsOn: [method],
        provider: PulumiUtil.awsProvider,
    }
);

///////////////////
// Deploy RestApi
///////////////////

const deployment = new aws.apigateway.Deployment(
    `${NAME}-${apiName}-deployment`,
    {
        restApi: restApi,
        description: `${NAME} deployment`,
        stageName: PulumiUtil.env,
    },
    {
        dependsOn: [integration],
        provider: PulumiUtil.awsProvider,
    }
);

// const lambdaAlias = new aws.lambda.Alias(`${NAME}-${apiName}`, {
//     description: "Alias to latest lambda",
//     functionName: lambdaNode.arn,
//     functionVersion: `$LATEST`,
// },
//     { provider: PulumiUtil.awsProvider, }
// );

////////////////////////////////////////
// Create Lambda APIGATEWAY Permission
////////////////////////////////////////
// Give permissions from API Gateway to invoke the Lambda
let invokePermission = new aws.lambda.Permission(
    `${NAME}-${apiName}`,
    {
        action: "lambda:invokeFunction",
        function: lambdaNode.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: deployment.executionArn,
        // qualifier: lambdaAlias.name,
    },
    { provider: PulumiUtil.awsProvider, }
);


//////////////////////////////////
// Export outputs
//////////////////////////////////

let helloEndpoint;
if (!STAGE.endsWith("local")) {
    helloEndpoint = pulumi.interpolate`${deployment.invokeUrl}/${helloPath}`;
} else {
    helloEndpoint = pulumi.interpolate`http://localhost:4566/restapis/${restApi.id}/${PulumiUtil.env}/_user_request_/${helloPath}`;
}

export const helloApiEndpoint = helloEndpoint;
