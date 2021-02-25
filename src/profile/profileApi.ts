require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
// const aws = require("@pulumi/aws");
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { Role } from "@pulumi/aws/iam";

import * as dbSecret from "../util/pg-db-util";
import { AwsUtil } from "../util/aws-util";
import { PulumiUtil } from "../util/pulumi-util";
import * as dbsecret from "../db-secrets";
import * as profileLambdas from "./lambda/node/profile-lambdas";

const STAGE: string = process.env.STAGE + "";
const REGION: string = process.env.REGION + "";
const NAME: string = process.env.APP_NAME + "";

let apiName = "profile";
//
// Setup Lambda IAM role
//
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

//
// Allow Lambda to read AWS Secrets
//
const readSecretLambdaPolicy = new aws.iam.Policy(`lambda-db-secrets-policy-${NAME}`, {
    description: "Profile API read secrets policy",
    path: "/",
    policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:GetResourcePolicy",
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:DescribeSecret",
                    "secretsmanager:ListSecretVersionIds"
                ],
                "Resource": [
                    "${dbsecret.dbSecretArn}"
                ]
            }
        ]
    }`,
}, { provider: PulumiUtil.awsProvider, }
);


const lambdaRole = new aws.iam.Role(
    `${NAME}-${apiName}`,
    { assumeRolePolicy: JSON.stringify(policy), },
    { provider: PulumiUtil.awsProvider, }
);

//
// Create IAM Role Policy
//
// Don't need policy attachment for localstack. Localstack hangs when you try to create these.
if (!STAGE.endsWith("local")) {
    const fullAccess = new aws.iam.RolePolicyAttachment(
        `${NAME}-${apiName}`,
        {
            role: lambdaRole,
            policyArn: aws.iam.ManagedPolicy.LambdaFullAccess,
        },
        { provider: PulumiUtil.awsProvider, }
    );
    let policyAttach3 = new aws.iam.RolePolicyAttachment(`${apiName}-lambda-db-secrets-attachment-${NAME}`, {
        role: lambdaRole,
        policyArn: readSecretLambdaPolicy.arn,
    }, { provider: PulumiUtil.awsProvider, }
    );
}

let envvars = {
    variables: {
        dbConnectStringSecretName: dbsecret.dbSecretName
    }
}
//
// Create Lambdas
//
let createProfileLambda = profileLambdas.lambdaCallbackFunction(`${NAME}-${apiName}-create-profile`, lambdaRole, profileLambdas.createProfile, undefined,
    envvars
);

let getProfileLambda = profileLambdas.lambdaCallbackFunction(`${NAME}-${apiName}-get-profile`, lambdaRole, profileLambdas.getProfile, undefined,
    envvars
);

const getProfilePythonLambda = new aws.lambda.Function(
    `${NAME}-${apiName}-get-profile-python`,
    {
        runtime: aws.lambda.Python3d8Runtime,
        code: new pulumi.asset.FileArchive("./src/profile/lambda/python/build/get_profile_by_id.zip"),
        timeout: 15,
        handler: "get_profile_by_id.handler",
        role: lambdaRole.arn,
        environment: envvars,
    },
    { provider: PulumiUtil.awsProvider, }
);



//
// Create APIGATEWAY
//
let restApi = new aws.apigateway.RestApi(
    `${NAME}-${apiName}`,
    {
        body: "",
        endpointConfiguration: {
            types: "REGIONAL",
        }
    },
    { provider: PulumiUtil.awsProvider, }
);



//
// Give the APIGW permission to invoke each Lambda
//
let invokePermission = new aws.lambda.Permission(
    `${NAME}-${apiName}-create`,
    {
        action: "lambda:invokeFunction",
        function: createProfileLambda.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${restApi.executionArn}/*/*`,
        // qualifier: lambdaAlias.name,
    },
    { 
        dependsOn: [createProfileLambda],
        provider: PulumiUtil.awsProvider, }
);

let invokeGetPermission = new aws.lambda.Permission(
    `${NAME}-${apiName}-get-byid`,
    {
        action: "lambda:invokeFunction",
        function: getProfileLambda.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${restApi.executionArn}/*/*`,
        // qualifier: lambdaAlias.name,
    },
    { 
        dependsOn: [getProfileLambda],
        provider: PulumiUtil.awsProvider, }
);


let invokeGetPythonPermission = new aws.lambda.Permission(
    `${NAME}-${apiName}-get-python-byid`,
    {
        action: "lambda:invokeFunction",
        function: getProfilePythonLambda.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${restApi.executionArn}/*/*`,
        // qualifier: lambdaAlias.name,
    },
    { 
        dependsOn: [getProfilePythonLambda],
        provider: PulumiUtil.awsProvider, }
);


//
// Every Lambda needs a Resource, Method, Integration
//
// ------------------ Start CreateProfile Setup --------------
//
// CreateProfile APIGW config
//
const createProfileResource = new aws.apigateway.Resource(
    `${NAME}-${apiName}-create-profile`,
    {
        restApi: restApi,
        pathPart: `profile`,
        parentId: restApi.rootResourceId,
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// CreateProfile Method
//
const createProfileMethod = new aws.apigateway.Method(
    `${NAME}-${apiName}-create-profile-post`,
    {
        restApi: restApi,
        resourceId: createProfileResource.id,
        httpMethod: "POST",
        authorization: "NONE",
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// CreateProfile  RestApi Lambda Integration
//
const createProfileInteg = new aws.apigateway.Integration(
    `${NAME}-${apiName}-create-profile`,
    {
        restApi: restApi,
        resourceId: createProfileResource.id,
        httpMethod: createProfileMethod.httpMethod,
        type: "AWS_PROXY",
        integrationHttpMethod: "POST",
        passthroughBehavior: "WHEN_NO_MATCH",
        uri: pulumi.interpolate`arn:aws:apigateway:${AwsUtil.region}:lambda:path/2015-03-31/functions/${createProfileLambda.arn}/invocations`
    },
    {
        dependsOn: [createProfileMethod],
        provider: PulumiUtil.awsProvider,
    }
);
//
// ------------------ End CreateProfile Setup --------------
//
//
// ------------------ Start GetProfile Setup --------------
//
// GetProfile APIGW config
//
const getProfileResource = new aws.apigateway.Resource(
    `${NAME}-${apiName}-get-profile`,
    {
        restApi: restApi,
        pathPart: `{profileId}`,
        parentId: createProfileResource.id,
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// CreateProfile Method
//
const getProfileMethod = new aws.apigateway.Method(
    `${NAME}-${apiName}-get-profile-post`,
    {
        restApi: restApi,
        resourceId: getProfileResource.id,
        httpMethod: "GET",
        authorization: "NONE",
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// CreateProfile  RestApi Lambda Integration
//
const getProfileInteg = new aws.apigateway.Integration(
    `${NAME}-${apiName}-get-profile`,
    {
        restApi: restApi,
        resourceId: getProfileResource.id,
        httpMethod: getProfileMethod.httpMethod,
        type: "AWS_PROXY",
        integrationHttpMethod: "POST",
        passthroughBehavior: "WHEN_NO_MATCH",
        uri: pulumi.interpolate`arn:aws:apigateway:${AwsUtil.region}:lambda:path/2015-03-31/functions/${getProfileLambda.arn}/invocations`
    },
    {
        dependsOn: [getProfileMethod],
        provider: PulumiUtil.awsProvider,
    }
);
//
// ------------------ End GetProfile Setup --------------
//
//
// ------------------ Start GetProfile Python Setup --------------
//
// GetProfile APIGW config
// PATH: /profile/python
const getProfilePythonResourceBase = new aws.apigateway.Resource(
    `${NAME}-${apiName}-get-python-base-profile`,
    {
        restApi: restApi,
        pathPart: 'python',
        parentId: createProfileResource.id,
    },
    { provider: PulumiUtil.awsProvider, }
);
// PATH: /profile/python/{profileId}
const getProfilePythonResource = new aws.apigateway.Resource(
    `${NAME}-${apiName}-get-python-profile`,
    {
        restApi: restApi,
        pathPart: `{profileId}`,
        parentId: getProfilePythonResourceBase.id,
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// GetProfile Python Method
//
const getProfilePythonMethod = new aws.apigateway.Method(
    `${NAME}-${apiName}-get-python-profile-get`,
    {
        restApi: restApi,
        resourceId: getProfilePythonResource.id,
        httpMethod: "GET",
        authorization: "NONE",
    },
    { provider: PulumiUtil.awsProvider, }
);
//
// GetProfile Python RestApi Lambda Integration
//
const getProfilePythonInteg = new aws.apigateway.Integration(
    `${NAME}-${apiName}-get-python-profile`,
    {
        restApi: restApi,
        resourceId: getProfilePythonResource.id,
        httpMethod: getProfilePythonMethod.httpMethod,
        type: "AWS_PROXY",
        integrationHttpMethod: "POST",
        passthroughBehavior: "WHEN_NO_MATCH",
        uri: pulumi.interpolate`arn:aws:apigateway:${AwsUtil.region}:lambda:path/2015-03-31/functions/${getProfilePythonLambda.arn}/invocations`
    },
    {
        dependsOn: [getProfilePythonMethod],
        provider: PulumiUtil.awsProvider,
    }
);
//
// ------------------ End GetProfile Python Setup --------------
//
// ------------------------------------------------
///////////////////
// Deploy RestApi
///////////////////

const profileDeployment = new aws.apigateway.Deployment(
    `${NAME}-${apiName}`,
    {
        restApi: restApi,
        description: `${NAME} deployment`,
        // stageName: PulumiUtil.env,
    },
    {
        dependsOn: [createProfileInteg],
        provider: PulumiUtil.awsProvider,
    }
);

const profileStage = new aws.apigateway.Stage(
    `${NAME}-${apiName}`,
    {
        deployment: profileDeployment.id,
        restApi: restApi.id,
        description: `${NAME} deployment`,
        stageName: PulumiUtil.env,
    },
    {
        dependsOn: [profileDeployment],
        provider: PulumiUtil.awsProvider,
    }
);





//
// Export outputs
//
let profileEndpoint;
if (!STAGE.endsWith("local")) {
    profileEndpoint = pulumi.interpolate`${profileStage.invokeUrl}/`;
} else {
    profileEndpoint = pulumi.interpolate`http://localhost:4566/restapis/${restApi.id}/${PulumiUtil.env}/_user_request_/`;
}

export const profileApiEndpoint = profileEndpoint;
export const createProfileLambdaId = createProfileLambda.id;
export const getProfilePythonLambdaId = getProfilePythonLambda.id;
