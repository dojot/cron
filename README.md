# Cron

The **Cron** is a dojot's microservice that allows you to schedule events to be emitted to other microservices.

## **Table of Contents**

- [Cron](#cron)
  - [**Table of Contents**](#table-of-contents)
  - [Overview](#overview)
    - [Dojot's messages from Kafka topics](#dojots-messages-from-kafka-topics)
    - [Writing data from kafka in Cron](#writing-data-from-kafka-in-cron)
  - [Dependencies](#dependencies)
    - [Dojot Services](#dojot-services)
    - [Others Services](#others-services)
  - [Running the service](#running-the-service)
    - [Configurations](#configurations)
      - [General Configurations](#general-configurations)
      - [MongoDB Configurations](#mongodb-configurations)
    - [SDK](#sdk)
      - [Producer](#producer)
        - [**Main object**](#main-object)
        - [**kafka.producer object**](#kafkaproducer-object)
      - [Consumer](#consumer)
        - [**Main object**](#main-object-1)
        - [**kafka.consumer object**](#kafkaconsumer-object)
        - [**kafka.topic object**](#kafkatopic-object)
      - [Service State Manager](#service-state-manager)
    - [How to run](#how-to-run)
  - [Documentation](#documentation)
  - [Issues and help](#issues-and-help)
- [**License**](#license)

## Overview

### Dojot's messages from Kafka topics

The **Cron** consumes the following dojot's messages:

- `*.dojot.tenancy` (Messages related to tenants' life cycle)

  - `CREATE` (Tenant was created):

    ```
        {
            "type": "CREATE",
            "tenant": <string: tenant>
        }
    ```

  - `DELETE` (Tenant was deleted):

    ```
        {
            "type": "DELETE",
            "tenant": <string: tenant>
        }
    ```

- `*.device-data` (Messages sent by devices to Dojot, publications)

  ```
  {
      "metadata": {
          "deviceid": <string:device ID>,
          "tenant": <string: tenant>,
          "timestamp": <integer: unix timestamp ms> | <string: Date-time RFC3339>,
          "shouldPersist": <boolean, is optional>
      },
      "attrs":{
          <string: attribute name>: <any JSON type>,
          …
          <string: attribute name>: <any JSON type>
      }
  }
  ```

- `*.dojot.device-manager.device` (Topic that receives messages sent by Dojot to devices and messages from device lifecycle events)

  - `configure`(Messages sent by dojot to devices, actuation):

    ```
        {
            "event":"configure",
            "data":{
                "attrs":{
                    "message":"keepalive"
                },
                "id":"c2b1a2"
            },
            "meta":{
                "service":"admin",
                "timestamp":1620950100008
            }
        }
    ```

Whereas that:

- `Any JSON type` means:
  - a string
  - a number
  - an object (JSON object)
  - an array
  - a boolean
  - null
- [`Date-time RFC3339`](https://tools.ietf.org/html/rfc3339#section-5.6) means:
  - A string described in RFC3339. Example: YYYY-MM-DDThh:mm:ss.fffffffffZ.
  - It can handle up to nanosecond precision in the _time-secfrac_ part.
  - It can handle accurately up to nanoseconds, the rest will be discarded.
- The key`shouldPersist` in attrs (is optional) means:
  - if this key does not exist or its value is `true`: the message attributes will be persisted.
  - its value is `false` : the message attributes will not be persisted.

### Writing data from kafka in Cron

In this section the idea is to explain what this service does with each message it consumes.

- `*.dojot.tenancy`

  - `CREATE`: This message will trigger the creation of a new _Organization_ (**tenant**) with a default _bucket_.
  - `DELETE`: This message will trigger the deletion of an existing _Organization_ (**tenant**).

- `*.device-data`: This message will trigger a data insertion. Its `attrs` will be saved in a _measurement_ (**deviceid**), in the default _bucket_ and in an _Organization_ (**tenant**). Each `key` from `attrs` will be a _field_ beginning with 'dojot.' with their respective values being serialized to a string.

- `*.dojot.device-manager.device`
  - `configure`: The same behavior as `*.device-data`.

**NOTE THAT** When service starts a default Organization with a default bucket, a default user with a default password and a default token must have **already been created**, optionally with a retention. You need to configure all of these values, see more at [general configurations](#general-configurations).

## Dependencies

The services dependencies are listed in the next topics.

- Dojot Services
- Others Services: They are external services;

### Dojot Services

none

### Others Services

- Kafka (tested using Kafka version 2.12)
- Mongodb (tested using Mongodb version 4.0)

## Running the service

### Configurations

Before running the **Cron** service within your environment, make sure you configure the
environment variables to match your needs.

You can select the configuration file via the `CRON_APP_USER_CONFIG_FILE` variable. Its default value
is `production.conf`. Check the [config directory](./config) for the user configurations that are
available by default.

For more information about the usage of the configuration files and environment variables, check the
**ConfigManager** module in our [Microservice SDK](https://github.com/dojot/dojot-microservice-sdk-js).
You can also check the [ConfigManager environment variables documentation](https://github.com/dojot/dojot-microservice-sdk-js/blob/master/lib/configManager/README.md#environment-variables) for more details.

In short, all the parameters in the next sections are mapped to environment variables that begin
with `CRON_`. You can either use environment variables or configuration files to change their values.
You can also create new parameters via environment variables by following the fore mentioned
convention.

#### General Configurations

| Key                             | Purpose                                                                                                      | Default Value                      | Valid Values             | Environment variable                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------ | ------------------------------------ |
| log.console.level               | Console logger level                                                                                         | info                               | info, debug, error, warn | CRON_LOG_CONSOLE_LEVEL               |
| log.file                        | Enables logging on file (location: /var/log/cron-logs-%DATE%.log)                                            | cron-${HOSTNAME:-}-logs-%DATE%.log | string                   | CRON_LOG_FILE                        |
| log.file.level                  | Log level to log on files                                                                                    | info                               | string                   | CRON_LOG_FILE_LEVEL                  |
| log.verbose                     | Whether to enable logger verbosity or not                                                                    | false                              | boolean                  | CRON_LOG_VERBOSE                     |
| healthChecker.kafka.interval.ms | Specific how often it is to check if it is possible to communicate with the _kafka_ service in milliseconds. | 30000                              | integer                  | CRON_HEALTHCHECKER_KAFKA_INTERVAL_MS |
| dojot.subjects.tenancy          | Suffix for dojot topic that receives exclusion and tenant creation events.                                   | dojot.tenancy                      | string                   | CRON_DOJOT.SUBJECTS.TENANCY          |
| dojot.subjects.devices          | Suffix for the dojot topic that sends data to devices and receives device lifecycle events.                  | dojot.device-manager.device        | string                   | CRON_DOJOT.SUBJECTS.DEVICES          |
| dojot.subjects.deviceData       | Suffix for the dojot topic that receives data from devices.                                                  | device-data                        | string                   | CRON_DOJOT.SUBJECTS.DEVICEDATA       |

#### MongoDB Configurations

| Key                          | Purpose                                                                                                   | Default Value | Valid Values            | Environment variable              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- | ----------------------- | --------------------------------- |
| db.mongodb.url               | Url and port for connection to the dataBase                                                               | string        | mongodb://mongodb:27017 | CRON_DB_MONGODB_URL               |
| dbOptions.useNewUrlParser    | Put the new connection string parser behind a flag                                                        | boolean       | true                    | CRON_DBOPTIONS_USENEWURLPARSER    |
| dbOptions.connectTimeoutMS   | How long the MongoDB driver will wait before killing a socket due to inactivity during initial connection | integer       | 2500                    | CRON*DBOPTION*.CONNECTTIMEOUTMS   |
| dbOptions.replicaSet         | Group of mongod instances that maintain the same data set                                                 | boolean       | false                   | CRON_DBOPTIONS_REPLICASET         |
| dbOptions.useUnifiedTopology | Set to true to opt in to using the MongoDB driver's new connection management engine                      | boolean       | true                    | CRON_DBOPTIONS_USEUNIFIEDTOPOLOGY |

### SDK

These parameters are passed directly to the SDK.
Check the [official repository](https://github.com/dojot/dojot-microservice-sdk-js) for more info on the values.

#### Producer

##### **Main object**

| Key                               | Default Value | Valid Values | Environment variable                   |
| --------------------------------- | ------------- | ------------ | -------------------------------------- |
| sdkProducer.connect.timeout.ms    | 5000          | integer      | CRON_SDKPRODUCER.CONNECT.TIMEOUT.MS    |
| sdkProducer.disconnect.timeout.ms | 10000         | integer      | CRON_SDKPRODUCER.DISCONNECT.TIMEOUT.MS |
| sdkProducer.flush.timeout.ms      | 2000          | integer      | CRON_SDKPRODUCER.FLUSH.TIMEOUT.MS      |

##### **kafka.producer object**

| Key                                            | Default Value | Valid Values                                                       | Environment variable                                |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| producer.metadata.broker.list                  | kafka:9092    | Initial list of brokers as a CSV list of broker host or host:port. | PRODUCER_METADATA_BROKER_LIST                       |
| producer.compression.codec                     | gzip          | string                                                             | CRON_PRODUCER_COMPRESSION_CODE                      |
| producer.retry.backoff.ms                      | 200           | integer                                                            | CRON_PRODUCER_RETRY_BACKOFF_MS                      |
| producer.message.send.max.retries              | 10            | integer                                                            | CRON_PRODUCER_MESSAGE_SEND_MAX_RETRIES              |
| producer.socket.keepalive.enable               | true          | boolean                                                            | CRON_PRODUCER_SOCKET_KEEPALIVE_ENABLE               |
| producer.queue.buffering.max.messages          | 100000        | integer                                                            | CRON_PRODUCER_QUEUE_BUFFERING_MAX_MESSAGES          |
| producer.queue.buffering.max.ms                | 1000          | integer                                                            | CRON_PRODUCER_QUEUE_BUFFERING_MAX_MS                |
| producer.batch.num.messages                    | 1000000       | integer                                                            | CRON_PRODUCER_BATCH_NUM_MESSAGES                    |
| producer.dr_cb                                 | true          | boolean                                                            | CRON_PRODUCER_DR_CB                                 |
| producer.enable.idempotence                    | false         | boolean                                                            | CRON_PRODUCER_ENABLE_IDEMPOTENCE                    |
| producer.max.in.flight.requests.per.connection | 1000000       | integer                                                            | CRON_PRODUCER_MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION |

#### Consumer

##### **Main object**

| Key                                       | Default Value | Valid Values | Environment variable                   |
| ----------------------------------------- | ------------- | ------------ | -------------------------------------- |
| sdkConsumer.in.processing.max.messages    | 1             | integer      | CRON_SDK_IN_PROCESSING_MAX_MESSAGES    |
| sdkConsumer.queued.max.messages.bytes     | 10485760      | integer      | CRON_SDK_QUEUED_MAX_MESSAGES_BYTES     |
| sdkConsumer.subscription.backoff.min.ms   | 1000          | integer      | CRON_SDK_SUBSCRIPTION_BACKOFF_MIN_MS   |
| sdkConsumer.subscription.backoff.max.ms   | 60000         | integer      | CRON_SDK_SUBSCRIPTION_BACKOFF_MAX_MS   |
| sdkConsumer.subscription.backoff.delta.ms | 1000          | integer      | CRON_SDK_SUBSCRIPTION_BACKOFF_DELTA_MS |
| sdkConsumer.commit.interval.ms            | 5000          | integer      | CRON_SDK_COMMIT_INTERVAL_MS            |

##### **kafka.consumer object**

| Key                                            | Default Value     | Valid Values                                                       | Environment variable                       |
| ---------------------------------------------- | ----------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| consumer.client.id                             | ${HOSTNAME:-cron} | string                                                             | CRON_CONSUMER_CLIENT_ID                    |
| consumer.group.id                              | cron              | string                                                             | CRON_CONSUMER_GROUP_ID                     |
| consumer.metadata.broker.list                  | kafka:9092        | Initial list of brokers as a CSV list of broker host or host:port. | CRON_CONSUMER_METADATA_BROKER_LIST         |
| consumer.max.in.flight.requests.per.connection | 1000000           | integer                                                            | CRON_MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION |
| consumer.socket.keepalive.enable               | false             | boolean                                                            | CRON_SOCKET_KEEPALIVE_ENABLE               |

##### **kafka.topic object**

| Key                     | Default Value | Valid Values                                               | Environment variable         |
| ----------------------- | ------------- | ---------------------------------------------------------- | ---------------------------- |
| topic.auto.offset.reset | earliest      | smallest, earliest, beginning, largest, latest, end, error | CRON_TOPIC_AUTO_OFFSET_RESET |
| topic.acks              | -1            | integer                                                    | CRON_TOPIC_ACKS              |

#### Service State Manager

These parameters are passed directly to the SDK ServiceStateManager. Check the
[official repository](https://github.com/dojot/dojot-microservice-sdk-js) for more info on the
values.

| Key                                 | Default Value | Valid Values | Environment variable                     |
| ----------------------------------- | ------------- | ------------ | ---------------------------------------- |
| lightship.detect.kubernetes         | false         | boolean      | CRON_LIGHTSHIP_DETECT_KUBERNETES         |
| lightship.graceful.shutdown.timeout | 120000        | number       | CRON_LIGHTSHIP_GRACEFUL_SHUTDOWN_TIMEOUT |
| lightship.shutdown.handler.timeout  | 15000         | number       | CRON_SHUTDOWN_HANDLER_TIMEOUT            |

### How to run

Beforehand, you need an already running dojot instance in your machine. Check out the
[dojot documentation](https://dojotdocs.readthedocs.io)
for more information on installation methods.

Generate the Docker image:

```shell
docker build -t <username>/cron:<tag> -f  .
```

Then an image tagged as`<username>/cron:<tag>` will be made available. You can send it to your DockerHub registry to made it available for non-local dojot installations:

```shell
docker push <username>/cron:<tag>
```

**NOTE THAT** you can use the official image provided by dojot in its [DockerHub page](https://hub.docker.com/r/dojot/cron.

## Documentation

Check the documentation for more information:

- [Latest dojot platform documentation](https://dojotdocs.readthedocs.io/en/latest)

## Issues and help

If you found a problem or need help, leave an issue in the main
[dojot repository](https://github.com/dojot/dojot) and we will help you!

# **License**

The Cron source code is released under Apache License 2.0.

Check NOTICE and LICENSE files for more information.
