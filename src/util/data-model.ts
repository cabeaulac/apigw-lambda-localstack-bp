import * as pgDbUtil from "./pg-db-util";

const createProfileQuery = "INSERT INTO user_profile (email, first_name, last_name) VALUES($1, $2, $3) RETURNING *";
const getProfileByEmailQuery = "SELECT * FROM user_profile WHERE email = $1";
const getProfileByIdQuery = "SELECT * FROM user_profile WHERE id = $1";
const deleteProfileQuery = "DELETE FROM user_profile WHERE id = $1";
export interface UserProfile {
    id?: number,
    email: string,
    first_name: string,
    last_name: string,
    created: Date
}

export async function createUserProfile(userProfile: UserProfile, pgdb: pgDbUtil.PgDb) {
    let res = await pgdb.runQuery(createProfileQuery, [userProfile.email, userProfile.first_name, userProfile.last_name]);
    let profile = null;
    if (res.rows.length > 0) {
        profile = res.rows[0] as UserProfile;
    }
    return profile;
}

export async function deleteUserProfile(userProfile: UserProfile, pgdb: pgDbUtil.PgDb) {
    let res = await pgdb.runQuery(deleteProfileQuery, [userProfile.id]);
    return res.rowCount;
}

export async function getUserProfileByEmail(userProfile: UserProfile, pgdb: pgDbUtil.PgDb) {
    let res = await pgdb.runQuery(getProfileByEmailQuery, [userProfile.email]);
    let profile = null;
    if (res.rows.length > 0) {
        profile = res.rows[0] as UserProfile;
    }
    return profile;
} 

export async function getUserProfileById(id: number, pgdb: pgDbUtil.PgDb) {
    let res = await pgdb.runQuery(getProfileByIdQuery, [id]);
    let profile = null;
    if (res.rows.length > 0) {
        profile = res.rows[0] as UserProfile;
    }
    return profile;
} 
