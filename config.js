"use strict";

module.exports = {
  kafkaMessenger: {
    kafka: {
      producer: {
        "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
        "compression.codec": process.env.COMPRESSION_CODEC || "gzip",
        "retry.backoff.ms": Number(process.env.RETRY_BACKOFF_MS) || 200,
        "message.send.max.retries": Number(process.env.MESSAGE_SEND_MAX_RETRIES) || 10,
        "socket.keepalive.enable": process.env.SOCKET_KEEPALIVE_ENABLE === "true" || true,
        "queue.buffering.max.messages": Number(process.env.QUEUE_BUFFERING_MAX_MESSAGES) || 100000,
        "queue.buffering.max.ms": Number(process.env.QUEUE_BUFFERING_MAX_MS) || 1000,
        "batch.num.messages": Number(process.env.BATCH_NUM_MESSAGES) || 1000000,
        dr_cb: process.env.DR_CB === "true" || true,
        "enable.idempotence": process.env.ENABLE_IDEMPOTENCE === "true",
        "max.in.flight.requests.per.connection": Number(process.env.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION) || 1000000,
      },

      consumer: {
        "group.id": process.env.KAFKA_GROUP_ID || "dojot-cron-group",
        "client.id": process.env.KAFKA_CLIENT_ID || "dojot-cron-client",
        "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
        "max.in.flight.requests.per.connection":
          Number(process.env.MAX_IN_FLIGHT_REQ_PER_CONN) || 1000000,
        "socket.keepalive.enable":
          process.env.SOCKET_KEEPALIVE_ENABLE === "true",
      },

      topic: {
        acks: Number(process.env.ACKS) || -1,
        "auto.offset.reset": process.env.AUTO_OFFSET_RESET || "beginning",
      },

      dojot: {
        subscriptionHoldoff:
          Number(process.env.DOJOT_SUBSCRIPTION_HOLDOFF) || 2500,
        timeoutSleep: Number(process.env.DOJOT_TIMEOUT_SLEEP) || 5,
        connectionRetries: Number(process.env.DOJOT_CONNECTION_RETRIES) || 5,
      },
    },

    databroker: {
      url: process.env.DATA_BROKER_URL || "http://data-broker",
      timeoutSleep: Number(process.env.DATABROKER_TIMEOUT_SLEEP) || 2,
      connectionRetries: Number(process.env.DATABROKER_CONNECTION_RETRIES) || 5,
    },

    auth: {
      url: process.env.AUTH_URL || "http://auth:5000",
      timeoutSleep: Number(process.env.AUTH_TIMEOUT_SLEEP) || 5,
      connectionRetries: Number(process.env.AUTH_CONNECTION_RETRIES) || 5,
    },

    deviceManager: {
      url: process.env.DEVICE_MANAGER_URL || "http://device-manager:5000",
      timeoutSleep: Number(process.env.DEVICEMANAGER_TIMEOUT_SLEEP) || 5,
      connectionRetries: Number(process.env.DEVICEMANAGER_CONNECTION_RETRIES) || 3,
    },

    dojot: {
      management: {
        user: process.env.DOJOT_MANAGEMENT_USER || "dojot-management",
        tenant: process.env.DOJOT_MANAGEMENT_TENANT || "dojot-management",
      },

      subjects: {
        tenancy: process.env.DOJOT_SUBJECT_TENANCY || "dojot.tenancy",
        devices:
          process.env.DOJOT_SUBJECT_DEVICES || "dojot.device-manager.device",
        deviceData: process.env.DOJOT_SUBJECT_DEVICE_DATA || "device-data",
      },
      events: {
        tenantEvent: {
          NEW_TENANT: process.env.TENANT_EVENT_NEW_TENANT || "new-tenant",
          DELETE_TENANT: process.env.TENANT_EVENT_DELETE_TENANT || "delete-tenant",
        },
        tenantActionType: {
          CREATE: process.env.TENANT_ACTION_TYPE_CREATE || "create",
          DELETE: process.env.TENANT_ACTION_TYPE_DELETE || "delete",
        },
      },
    },
  },

  sdk: {
    consumer: {
      "in.processing.max.messages": Number(process.env.IN_PROCESSING_MAX_MESSAGES) || 1,
      "queued.max.messages.bytes": Number(process.env.QUEUED_MAX_MESSAGES_BYTES) || 10485760,
      "subscription.backoff.min.ms": Number(process.env.SUBSCRIPTION_BACKOFF_MIN_MS) || 1000,
      "subscription.backoff.max.ms": Number(process.env.SUBSCRIPTION_BACKOFF_MAX_MS) || 60000,
      "subscription.backoff.delta.ms": Number(process.env.SUBSCRIPTION_BACKOFF_DELTA_MS) || 1000,
      "commit.interval.ms": Number(process.env.COMMIT_INTERVAL_MS) || 5000,
    },
    producer: {
      "connect.timeout.ms": Number(process.env.CONNECT_TIMEOUT_MS) || 5000,
      "disconnect.timeout.ms": Number(process.env.DISCONNECT_TIMEOUT_MS) || 10000,
      "flush.timeout.ms": Number(process.env.FLUSH_TIMEOUT_MS) || 2000,
      "pool.interval.ms": Number(process.env.POOL_INTERVAL_MS) || 100,
    },
  },













  cronManager: {
    actions: {
      http: {
        allowedBaseURLs: process.env.HTTP_ALLOWED_BASE_URLS || [
          "http://device-manager:5000",
        ],
        timeout: Number(process.env.HTTP_TIMEOUT) || 5000,
      },

      broker: {
        allowedSubjects: process.env.BROKER_ALLOWED_SUBJECTS || [
          "dojot.device-manager.device",
          "device-data",
        ],
      },
    },

    db: {
      mongodb: {
        url: process.env.MONGO_URL || "mongodb://mongodb:27017",
        options: {
          useNewUrlParser: process.env.DB_USE_NEW_URL_PARSER_REPLICA_SET === "true" || true,
          connectTimeoutMS: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 2500,
          //   reconnectTries: 100,
          //   reconnectInterval: 2500,
          //   autoReconnect: true,
          replicaSet: process.env.DB_REPLICA_SET === "true",
          useUnifiedTopology: process.env.DB_USE_UNIFIED_TOPOLOGY === "true" || true,
        },
      },
    },
  },

  healthChecker: {
    timeout: {
      uptime: process.env.HC_UPTIME_TIMEOUT || 300000,
      memory: process.env.HC_MEMORY_USAGE_TIMEOUT || 300000,
      cpu: process.env.HC_CPU_USAGE_TIMEOUT || 300000,
      mongodb: process.env.HC_MONGODB_TIMEOUT || 30000,
      kafka: process.env.HC_KAFKA_TIMEOUT || 30000,
    },
  },

  logger: {
    // level: process.env.LOG_LEVEL || "info",
    "console.level": process.env.LOGGER_CONSOLE_LEVEL || "info",
    file: {
      enable: process.env.LOGGER_FILE_ENABLE === "true",
      filename: process.env.LOGGER_FILENAME || "CRON.log",
      level: process.env.LOGGER_LEVEL || "info",
    },
    verbose: process.env.LOGGER_VERBOSE === "true",
  },
};
