import json
import psycopg2
# import the error handling libraries for psycopg2
from psycopg2 import OperationalError, errorcodes, errors, extras


class DbConnection:
    """
    Encapsulate a DB connection.
    Example usage in scoped with block
        with dbu.DbConnection(json.loads(dbConnectValue['SecretString'])) as conn:
            profile = dbu.Profile(conn)
            p = profile.api_get_profile_by_id(event['pathParameters']['profileId'])
    """
    def __init__(self, db_secret, autocommit=True):
        """
        :param db_secret Database secret value
        """
        self.db_secret = db_secret
        self.autocommit = autocommit
        self.conn = None

    def __enter__(self):
        # dbname – the database name (database is a deprecated alias)
        # user – user name used to authenticate
        # password – password used to authenticate
        # host – database host address (defaults to UNIX socket if not provided)
        # port – connection port 
        self.conn = psycopg2.connect(dbname=self.db_secret["database"],
            user=self.db_secret["user"],
            password=self.db_secret["password"],
            host=self.db_secret["host"],
            port=self.db_secret["port"])
        self.conn.set_session(autocommit=self.autocommit)
        return self


    def __exit__(self, type, value, traceback):
        if self.autocommit is False:
            self.conn.commit()
        self.conn.close()



class Profile:
    """
    Operations on the user_profile DB table
    """

    def __init__(self, dbcon):
        """
        :param dbcon Database connection
        """
        self.dbcon = dbcon

    def api_get_profile_by_id(self, id):
        """
        Get a profile for a given id. Methods that start with API are entry points and return
        valid API Gateway responses.

        :param id A profile ID
        :return API Gateway response object
        """
        apigw_return = {
            "statusCode": 200,
            "header": {
                "content-type": "application/json"
                }
            }
        try:
            p = self.get_profile_by_id(id)
            # set body to JSON string. Serialize non-serializable attributes with str function
            apigw_return["body"] = json.dumps(p, default=str)
        except errors.NoData as nd:
            print('NoData error', nd)
            apigw_return['statusCode'] = 404
            apigw_return['body'] = json.dumps({ 'msg': nd}, default=str)

        return apigw_return


    def get_profile_by_id(self, id):
        p = None
        print(f"get_profile_by_id with id = {id}")
        # Use with to get cursor transactions
        with self.dbcon.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Fetch the user_profile
            cur.execute("SELECT * FROM user_profile where id = %s;", (id,))
            p = cur.fetchone()

        if p is None:
            raise errors.NoData('profile id ' + id + ' not found')

        return { "id": p[0],
            "email": p[1],
            "first_name": p[2],
            "last_name": p[3],
            "created": p[4]
        }