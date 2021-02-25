import sys
import json
import os
import boto3

import argparse
import base64
import json
import logging
from pprint import pprint
import time
from botocore.exceptions import ClientError
from lib42.aws_util import SecretsManagerSecret
import lib42.db_util as dbu

# Declare global vars
logger = logging.getLogger(__name__)
dbConnectSecretName = os.environ['dbConnectStringSecretName']
region = os.environ['AWS_REGION']

dbSecret = SecretsManagerSecret(secretsmanager_client=None)
dbConnectValue = None


#
# Lambda Function Handler
# Get Profile by ID
#
def handler(event, context):
    global region
    global dbSecret
    global dbConnectValue
    global dbConnectSecretName
    p = None
    print(f'Region: {region}')
    print(f"Event details: {event}")
    print(f"APIGW Host: {event['headers']['Host']}")
    # If we haven't set the DB Secret yet, do it
    if dbSecret.secretsmanager_client is None:
        host = event['headers']['Host']
        # Is this running on localstack, override the connection params
        if host == 'localhost:4566':
            print("set SecretManager with localstack endpoint")
            dbSecret.set_client(client=boto3.client('secretsmanager',  region_name=region, api_version=None, use_ssl=False, verify=None,
                                                    endpoint_url='http://localstack:4566', aws_access_key_id='test', aws_secret_access_key='test', aws_session_token=None, config=None))
        else:
            print("set SecretManager with native endpoint")
            dbSecret.set_client(client=boto3.client(
                'secretsmanager', region_name=region))
        dbSecret.name = dbConnectSecretName
        dbConnectValue = dbSecret.get_value()
    print(f"Secret value: {dbConnectValue['SecretString']}")
    # Create a DB connection in scoped with block to auto-release
    # Create a DB Util Profile class instance with the DB connection
    # Get a profile by ID
    # Return the profile 
    with dbu.DbConnection(json.loads(dbConnectValue['SecretString'])) as conn:
        profile = dbu.Profile(conn)
        p = profile.api_get_profile_by_id(event['pathParameters']['profileId'])
    print(f"profile.get_profile_by_id = {p}")
    return p