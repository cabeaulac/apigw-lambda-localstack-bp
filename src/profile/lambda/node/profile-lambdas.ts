import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { Role } from "@pulumi/aws/iam";
import * as awsUtil from "../../../util/aws-util";
import * as pgDbUtil from "../../../util/pg-db-util";
import { PulumiUtil } from "../../../util/pulumi-util";
import * as model from "../../../util/data-model";

class DbSecretCache {
    aSecret: pgDbUtil.Config | null = null;
    constructor() { }

    async getDbSecret() {
        if (!this.aSecret) {
            if (process.env.dbConnectStringSecretName) {
                // Set AWS Region 
                if (process.env.AWS_REGION) {
                    awsUtil.AwsUtil.region = process.env.AWS_REGION;
                }
                // Set Endpoint for testing with Localstack only
                if (process.env.LOCALSTACK_HOSTNAME && process.env.EDGE_PORT) {
                    awsUtil.AwsUtil.endpoint = `http://${process.env.LOCALSTACK_HOSTNAME}:${process.env.EDGE_PORT}`;
                }
                console.log("retrieving conn string");

                let connString = await awsUtil.AwsUtil.getSecretValue(process.env.dbConnectStringSecretName!);
                this.aSecret = JSON.parse(connString);
                console.log("secret\n", connString);
            }
            else {
                throw new ProfileError(500, "dbConnectStringSecretName not in Lambda env");
            }
        }
        return this.aSecret;
    }

}

const dbSecretCache = new DbSecretCache();




class ProfileError extends Error {
    statusCode: number;
    constructor(statusCode = 400, message: string) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(message);
        this.constructor = ProfileError;

        this.message = message;
        // This clips the constructor invocation from the stack trace.
        // It's not absolutely essential, but it does make the stack trace a little nicer.
        Error.captureStackTrace(this, this.constructor);

        // Custom debugging information
        this.statusCode = statusCode;
    }
}


function isObject(val: any) {
    if (!val) { return false; }
    return (typeof val === 'object');
}

function validateBody(body: any) {
    if (body.email === undefined) {
        console.log("no email field");
        throw new ProfileError(400, "email field in JSON body must be present");
    }
    // Check for valid email
    if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(body.email)) {
        return (true);
    }
    else {
        console.log("invalid email field");
        throw new ProfileError(400, "email field in JSON body is not a valid email");
    }
}

//
// Creates Lambda Function
// This approach makes it easy to create Lambdas inside the IaC.
//
export function lambdaCallbackFunction(name: string, role: Role, f: aws.lambda.Callback<awsx.apigateway.Request, awsx.apigateway.Response>, vpcConfig?: any, functionEnvironment?: any) {
    return new aws.lambda.CallbackFunction(name, {
        role: role,
        vpcConfig: vpcConfig,
        environment: functionEnvironment,
        timeout: 15,
        //fileSystemConfig: { arn: ap.arn, localMountPath: "/mnt/storage" },
        callback: f,
    },
        { provider: PulumiUtil.awsProvider, });
}


//
// Create Profile Lambda function
// 
// Type POST
// Create a new Order
//
export async function createProfile(event: awsx.apigateway.Request): Promise<awsx.apigateway.Response> {
    console.log("enter createProfile");
    console.log("Env ", process.env);
    console.log("createProfile for", event);
    // Create a default response
    let resp = {
        statusCode: 200,
        body: "{}",
        header: {
            "content-type": "application/json"
        }
    }
    let body;
    let pgDb: pgDbUtil.PgDb | null = null;

    try {

        if (event.body !== undefined && event.body) {
            console.log("Event ");
            console.log(JSON.stringify(event));
            if (event.isBase64Encoded) {
                body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf8'));
            }
            else {
                body = JSON.parse(event.body);
            }
            console.log(JSON.stringify(body));
            //
            // Create new Profile
            //
            validateBody(body);
            let thesecret = await dbSecretCache.getDbSecret();
            if (thesecret) {
                pgDb = await new pgDbUtil.PgDb(thesecret);
            }
            else {
                throw new ProfileError(500, "Can't get DB secret");
            }

            let userProfile = await model.createUserProfile(body, pgDb!) as model.UserProfile;
            resp["body"] = JSON.stringify(userProfile);
        }
        else {
            console.log("no body in message");
            throw new ProfileError(400, "no HTTP method body provided");
        }
    }
    catch (err) {
        console.log("err\n", err);
        console.log("error.message ", err.message);
        // If we got an unexpected exception
        resp.statusCode = 500;
        if (err instanceof ProfileError) {
            resp.statusCode = err.statusCode;
        }
        if (err.code) {
            // Duplicate key constraint
            // Unique Violation Error Code https://www.postgresql.org/docs/9.2/errcodes-appendix.html
            if (err.code == "23505") {
                resp.statusCode = 409
            }
        }
        resp.body = JSON.stringify({ msg: err.message });
    }
    finally {
        if (pgDb) {
            pgDb.dropConnection();
        }
    }
    return resp;

}



//
// Create Profile Lambda function
// 
// Type POST
// Create a new Order
//
export async function getProfile(event: awsx.apigateway.Request): Promise<awsx.apigateway.Response> {
    console.log("enter getProfile");
    console.log("Env ", process.env);
    console.log("getProfile for", event);
    // Create a default response
    let resp = {
        statusCode: 200,
        body: "{}",
        header: {
            "content-type": "application/json"
        }
    }
    let pgDb: pgDbUtil.PgDb | null = null;

    try {
        let thesecret = await dbSecretCache.getDbSecret();
        if (thesecret) {
            pgDb = await new pgDbUtil.PgDb(thesecret);
        }
        else {
            throw new ProfileError(500, "Can't get DB secret");
        }
        //
        // Create new Profile
        //
        const profileId: string | undefined = event.pathParameters!['profileId'];

        // Force unwrap profileId and coerce to number with + unary operator
        let userProfile = await model.getUserProfileById(+profileId!, pgDb!) as model.UserProfile;
        resp["body"] = JSON.stringify(userProfile);
    }
    catch (err) {
        console.log("err\n", err);
        console.log("error.message ", err.message);
        // If we got an unexpected exception
        resp.statusCode = 500;
        if (err instanceof ProfileError) {
            resp.statusCode = err.statusCode;
        }
        resp.body = JSON.stringify({ msg: err.message });
    }
    finally {
        if (pgDb) {
            pgDb.dropConnection();
        }
    }
    return resp;

}
