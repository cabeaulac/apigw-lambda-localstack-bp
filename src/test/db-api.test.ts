const pulumiOutputs = require('./test-input.json');
import * as httpHelper from './http-util';
import * as awsUtil from "../util/aws-util";
import * as pgDbUtil from "../util/pg-db-util";
import * as model from "../util/data-model";
import { toObject } from '@pulumi/pulumi/iterable';

let dbSecret: pgDbUtil.Config;
let pgDb: pgDbUtil.PgDb | null = null;

async function initDatabase() {
    console.log("init database");
    // Create PgDb class to wrap our connection to the DB
    let res = await pgDb!.runQuery("DELETE from user_profile");
}

beforeEach(() => {
    return initDatabase();
});



//
// Get the DB connection config from AWS SecretsManager and connect to PostgreSQL DB before all the tests
//
beforeAll(async () => {
    // Set AWS Endpoint and Region for testing
    awsUtil.AwsUtil.endpoint = "http://localhost:4566";
    awsUtil.AwsUtil.region = "us-east-1";
    console.log("pulumi outputs: " + JSON.stringify(pulumiOutputs));
    console.log("DB Secred Id: " + pulumiOutputs["dbSecretId"]);
    dbSecret = JSON.parse(await awsUtil.AwsUtil.getSecretValue(pulumiOutputs["dbTestSecretName"]));
    console.log("DB Secret : " + dbSecret);
    pgDb = await new pgDbUtil.PgDb(dbSecret);

});

//
// Drain the PG DB connection pool after all of the tests are done
//
afterAll(() => {
    // If the pgDb instance has been set, drain the PostgreSQL pool
    pgDb?.dropConnection();
});

// --------------------------------------------------------
// API Gateway Tests
//

//
// Get a UserProfile that doesn't exist
test('API - Get unknown UserProfile', async () => {
    // example consuming code
    let response: httpHelper.HttpResponse<model.UserProfile>;
    let caller = new httpHelper.HttpCaller();
    // expect one assertion, to happen in the catch clause
    expect.assertions(1);
    try {
        response = await caller.get<model.UserProfile>(
            `${pulumiOutputs.profileApiEndpoint}profile/5`
        );
        expect(response.status).toBe(404);
    } catch (response) {
        console.log("Error", response);
    }
});

//
// POST a new UserProfile
// Assert the Response has all the correct values
// GET the same UserProfile by id
// Assert the Response has all the correct values
test('API - Create one UserProfile', async () => {
    // example consuming code
    
    let response: httpHelper.HttpResponse<model.UserProfile>;
    let response2: httpHelper.HttpResponse<model.UserProfile>;
    let caller = new httpHelper.HttpCaller();
    // expect one assertion, to happen in the catch clause
    let profile = { email: "chad@domain.com", first_name: "Chad", last_name: "Beaulac" } as model.UserProfile;

    response = await caller.post<model.UserProfile>(
        `${pulumiOutputs.profileApiEndpoint}profile/`,
        profile
    );
    expect(response.status).toBe(200);
    expect(response.parsedBody).toBeTruthy();
    // Force the unwrapping of the optional parsedBody with the postfix ! operator
    let up: model.UserProfile = response.parsedBody!;
    expect(up.email).toBe("chad@domain.com");
    expect(up.first_name).toBe("Chad");
    expect(up.last_name).toBe("Beaulac");
    expect(up.id!).toBeGreaterThan(0);
    // Get the UserProfile we just created
    response2 = await caller.get<model.UserProfile>(
        `${pulumiOutputs.profileApiEndpoint}profile/${up.id}`
    );
    expect(response2.status).toBe(200);
});


// --------------------------------------------------------
// Direct to DB Tests
//


//
// Create a profile
// Assert values
// Query for profile by email
// Assert values
// Query for profile by id
// Assert values
// Delete query, assert rows affected
//
test('DB - Create One Profile', async () => {
    // example consuming code
    let profile = { email: "chad@domain.com", first_name: "Chad", last_name: "Beaulac" } as model.UserProfile;
    let userProfile = await model.createUserProfile(profile, pgDb!) as model.UserProfile;
    expect(userProfile.id).toBeGreaterThan(0);
    expect(userProfile.email).toBe("chad@domain.com");
    expect(userProfile.first_name).toBe("Chad");
    expect(userProfile.last_name).toBe("Beaulac");
    userProfile = await model.getUserProfileByEmail(userProfile, pgDb!) as model.UserProfile;
    expect(userProfile.id).toBeGreaterThan(0);
    expect(userProfile.email).toBe("chad@domain.com");
    expect(userProfile.first_name).toBe("Chad");
    expect(userProfile.last_name).toBe("Beaulac");
    userProfile = await model.getUserProfileById(userProfile.id!, pgDb!) as model.UserProfile;
    expect(userProfile.id).toBeGreaterThan(0);
    expect(userProfile.email).toBe("chad@domain.com");
    expect(userProfile.first_name).toBe("Chad");
    expect(userProfile.last_name).toBe("Beaulac");
    let rowCount = await model.deleteUserProfile(userProfile, pgDb!);
    expect(rowCount).toBe(1);
    userProfile = await model.getUserProfileByEmail(userProfile, pgDb!) as model.UserProfile;
    expect(userProfile).toBeFalsy;
});

//
// Create a profile
// Create profile with same email should fail.
//
test('DB - Create duplicate Profile', async () => {
    // expect one assertion, to happen in the catch clause
    expect.assertions(1);
    let profile = { email: "chad@domain.com", first_name: "Chad", last_name: "Beaulac" } as model.UserProfile;
    try {
        let userProfile = await model.createUserProfile(profile, pgDb!) as model.UserProfile;
        // Create the profile again with the same email
        userProfile = await model.createUserProfile(profile, pgDb!) as model.UserProfile;
        // We expect and error. If we don't get an error, fail
    }
    catch (err) {
        console.log("err", err);
        // Expect Unique Violation Error Code https://www.postgresql.org/docs/9.2/errcodes-appendix.html
        expect(err.code).toBe("23505");
    }
});
