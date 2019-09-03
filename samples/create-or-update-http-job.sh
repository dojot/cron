#!/bin/bash

USAGE="$0 -d <dojot-url> -u <dojot-user> -p <dojot-password> [-j <job-id>]"

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

if [ -z ${DOJOT_URL} ] || [ -z ${DOJOT_USERNAME} ] || [ -z ${DOJOT_PASSWD} ]
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

# Create Template
echo 'Creating template ...'
TEMPLATE_ID=$(curl --silent -X POST ${DOJOT_URL}/template \
-H 'Content-Type:application/json' \
-H "Authorization: Bearer ${JWT}" \
-d  '{
       "label": "CronBrokerJobTemplate",
       "attrs": [
                  {
                    "label": "message",
                    "type": "actuator",
                    "value_type": "string"}
               ]
    }' | jq '.template.id' | tr -d '"')
echo "... Created template ${TEMPLATE_ID}."

# Create Device
echo 'Creating device ...'
DEVICE_ID=$(curl --silent -X POST ${DOJOT_URL}/device \
-H 'Content-Type:application/json' \
-H "Authorization: Bearer ${JWT}" \
-d  "{
        \"templates\": [\"${TEMPLATE_ID}\"],
        \"attrs\": {},
        \"label\": \"CronBrokerJobDevice\"
    }" | jq '.devices[0].id' | tr -d '"')
echo "... Created device ${DEVICE_ID}."

# Create Data Broker Job
REQUEST_COMMAND='POST'
FULL_URL="${DOJOT_URL}/cron/v1/jobs"
if [ ! -z ${CRON_JOB_ID} ]
then
    REQUEST_COMMAND='PUT'
    FULL_URL="${DOJOT_URL}/cron/v1/jobs/${CRON_JOB_ID}"
fi

echo 'Scheduling a cron job (keepalive) ...'
RESPONSE=$(curl -w "\n%{http_code}" --silent -X ${REQUEST_COMMAND} ${FULL_URL} \
-H "Content-Type:application/json" \
-H "Authorization: Bearer ${JWT}" \
-d "{
      \"time\": \"*/5 * * * *\",
      \"timezone\": \"America/Sao_Paulo\",
      \"name\": \"Keep alive\",
      \"description\": \"This job sends a keep alive notification to a device every 5 minutes\",
      \"http\": {
                  \"method\": \"PUT\",
                  \"headers\": {
                                \"Authorization\": \"Bearer ${JWT}\",
                                \"Content-Type\": \"application/json\"
                              },
                  \"url\": \"http://device-manager:5000/device/${DEVICE_ID}/actuate\",
                  \"body\": {
                              \"attrs\": {
                                            \"message\": \"keepalive\"
                                          }
                            }
                }
    }")
RESPONSE=(${RESPONSE[@]}) # convert to array
HTTP_STATUS=${RESPONSE[-1]} # get last element (last line)
BODY=(${RESPONSE[@]::${#RESPONSE[@]}-1}) # get all elements except last

if [ "${HTTP_STATUS}" == "201" ]
then
  echo "... Succeeded to create cron job."
  echo "${BODY[*]}"
elif [ "${HTTP_STATUS}" == "200" ]
then
  echo "... Succeeded to update cron job."
  echo "${BODY[*]}"
else
  echo '... Failed to create cron job.'
  echo "${BODY[*]}"
fi
