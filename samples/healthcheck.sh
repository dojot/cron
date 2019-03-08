#!/bin/bash

USAGE="$0 -d <dojot-url> -u <dojot-user> -p <dojot-password>"

while getopts "d:u:p:" options; do
  case $options in
    d ) DOJOT_URL=$OPTARG;;
    u ) DOJOT_USERNAME=$OPTARG;;
    p ) DOJOT_PASSWD=$OPTARG;;
    \? ) echo ${USAGE}
         exit 1;;
    * ) echo ${USAGE}
          exit 1;;
  esac
done

if [ -z ${DOJOT_URL} ] || [ -z ${DOJOT_USERNAME} ] ||
   [ -z ${DOJOT_PASSWD} ]
then
    echo ${USAGE}
    exit 1
fi

# JWT Token
echo 'Getting jwt token ...'
JWT=$(curl --silent -X POST ${DOJOT_URL}/auth \
-H "Content-Type:application/json" \
-d "{\"username\": \"${DOJOT_USERNAME}\", \"passwd\" : \"${DOJOT_PASSWD}\"}" | jq '.jwt' | tr -d '"')
echo "... Got jwt token ${JWT}."


# Get status
echo "Getting cron service status ..."
RESPONSE=$(curl --silent -X GET ${DOJOT_URL}/cron/v1/healthCheck \
-H "Authorization: Bearer ${JWT}")

echo "... Got response:"
echo "${RESPONSE}"
