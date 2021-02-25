import { IdentityPool } from "@pulumi/aws/cognito";


// Use DB Client instead of Pool. When this solution is pushed to AWS, the Client target is an RDS DB Proxy (pool). 
// If the target isn't an RDS Proxy because RDS Proxy isn't supported for the target DB, then we use 
const { Client } = require('pg');

export interface Config {
    user: string,
    password: string,
    host: string,
    port: number,
    database: string
}


export class PgDb {
    private client: typeof Client = null;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.connectDb();
    }

    public async dropConnection() {
        console.log("dropConnection");
        // await this.pool.end();
        await this.client.end();
        this.client = null;
    }

    public async runQuery(query: string, values: any[] = []) {
        // async/await - check out a client
        // Pool impl
        //const pclient = await this.pool.connect();
        let res;
        try {
            res = await this.client.query(query, values);
            console.log("query result - ", res.rows);
        } finally {
            // Make sure to release the client before any error handling,
            // just in case the error handling itself throws an error.

            // Pool impl
            // pclient.release()
        }
        return res;

    }

    private async connectDb() {
        this.client = await new Client(this.config);
        await this.client.connect();
        // Use a pool if the target connection is direct to a DB and not a DB Proxy.
        // this.pool = await new Pool(this.config);

    }
}