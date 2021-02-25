#!/bin/bash
set -e

PASSWORD=bppassword psql -v ON_ERROR_STOP=1 --username bpuser --dbname postgres -f /usr/local/db/localapi_blueprint.sql