require('dotenv').config();
const fs = require('fs');
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
import * as awsx from "@pulumi/awsx";
import * as random from "@pulumi/random";
import {AwsUtil} from "./util/aws-util"
import {PulumiUtil} from "./util/pulumi-util";
import * as ProfileLambda from "./profile/lambda/node/profile-lambdas"
import * as ProfileApi from "./profile/profileApi";

const STAGE: string = process.env.STAGE + "";
const REGION: string = process.env.REGION + "";
const NAME: string = process.env.APP_NAME + "";
const helloPath: string = "apath";

let stackPieces: string[] = pulumi.getStack().split('.');
const env = stackPieces[stackPieces.length - 1];

let databaseName = "bpdb";
let dbUsername = "bpuser";

//
// Generate a random password for the RDS Cluster
//
const dbPassword = new random.RandomPassword("password", {
    length: 16,
    special: true,
    overrideSpecial: `[]{}()#!`,
});

// This is the password used for the DB running locally on Docker
// We change this to the random password declared right above if the pipeline isn't local.
let pgdbPassword = "bppassword";
if (!STAGE.endsWith("local")) {
    pgdbPassword = pulumi.interpolate`dbPassword.result`;
}

////////////////////////
// Create AWS Provider
////////////////////////


//
// Create a DB connection secret and store in AWS Secrets Manager
//
const dbTestSecretKey = `db.test.conn.string-${env}`;
const dbTestSecret = new aws.secretsmanager.Secret(dbTestSecretKey, {}, { provider: PulumiUtil.awsProvider, });
const dbTestSecretVersion = new aws.secretsmanager.SecretVersion(dbTestSecretKey, {
    secretId: dbTestSecret.id,
    secretString: pulumi.interpolate`{
        "user": "${dbUsername}",
        "password": "${pgdbPassword}",
        "host": "localhost",
        "port": 5432, 
        "database": "${databaseName}",
        "connectionTimeoutMillis": 5000
      }`,
},
    { provider: PulumiUtil.awsProvider, }
);

const dbLocalSecretKey = `db.conn.string-${env}`;
const dbLocalSecret = new aws.secretsmanager.Secret(dbLocalSecretKey, {}, { provider: PulumiUtil.awsProvider, });
const dbLocalSecretVersion = new aws.secretsmanager.SecretVersion(dbLocalSecretKey, {
    secretId: dbLocalSecret.id,
    secretString: pulumi.interpolate`{
        "user": "${dbUsername}",
        "password": "${pgdbPassword}",
        "host": "database",
        "port": 5432, 
        "database": "${databaseName}",
        "connectionTimeoutMillis": 5000,
        "query_timeout": 5000,
        "statement_timeout": 5000,
        "idle_in_transaction_session_timeout": 5000
      }`,
},
    { provider: PulumiUtil.awsProvider, }
);


export const dbTestSecretName = dbTestSecret.name;
export const dbTestSecretArn = dbTestSecret.arn;

export const dbSecretName = dbLocalSecret.name;
export const dbSecretArn = dbLocalSecret.arn;