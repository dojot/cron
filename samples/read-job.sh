#!/bin/bash

USAGE="$0 -d <dojot-url> -u <dojot-user> -p <dojot-password> -j <job-id>"

while getopts "d:u:p:j:" options; do
  case $options in
    d ) DOJOT_URL=$OPTARG;;
    u ) DOJOT_USERNAME=$OPTARG;;
    p ) DOJOT_PASSWD=$OPTARG;;
    j ) CRON_JOB_ID=$OPTARG;;
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


# Get cron job
echo "Getting cron job ${CRON_JOB_ID} ..."
RESPONSE=$(curl --silent -X GET ${DOJOT_URL}/cron/v1/jobs/${CRON_JOB_ID} \
-H "Authorization: Bearer ${JWT}")

echo "... Got cron job response:" 
echo "${RESPONSE}"
