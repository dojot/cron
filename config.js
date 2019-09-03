"use strict";

module.exports = {

    'kafkaMessenger' : {
      kafka: {
        producer: {
          "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
          "compression.codec": "gzip",
          "retry.backoff.ms": 200,
          "message.send.max.retries": 10,
          "socket.keepalive.enable": true,
          "queue.buffering.max.messages": 100000,
          "queue.buffering.max.ms": 1000,
          "batch.num.messages": 1000000,
          "dr_cb": true
        },

        consumer: {
          "group.id": process.env.KAFKA_GROUP_ID || "dojot-cron",
          "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
        },

        dojot: {
          subscriptionHoldoff: Number(process.env.DOJOT_SUBSCRIPTION_HOLDOFF) || 2500,
          timeoutSleep: 5,
          connectionRetries: 5
        }
      },

      databroker: {
        url: process.env.DATA_BROKER_URL || "http://data-broker",
        timeoutSleep: 2,
        connectionRetries: 5,
      },

      auth: {
        url: process.env.AUTH_URL || "http://auth:5000",
        timeoutSleep: 5,
        connectionRetries: 5,
      },

      deviceManager: {
        url: process.env.DEVICE_MANAGER_URL || "http://device-manager:5000",
        timeoutSleep: 5,
        connectionRetries: 3,
      },

      dojot: {
        management: {
          user: process.env.DOJOT_MANAGEMENT_USER || "dojot-management",
          tenant: process.env.DOJOT_MANAGEMENT_TENANT || "dojot-management"
        },

        subjects: {
          tenancy: process.env.DOJOT_SUBJECT_TENANCY || "dojot.tenancy",
          devices: process.env.DOJOT_SUBJECT_DEVICES || "dojot.device-manager.device",
          deviceData: process.env.DOJOT_SUBJECT_DEVICE_DATA || "device-data",
        }
      }
    },

    'cronManager': {
      actions: {
        http: {
          allowedBaseURLs: process.env.HTTP_ALLOWED_BASE_URLS || [
            'http://device-manager:5000'
          ],
          timeout: 5000
        },

        broker: {
          allowedSubjects: process.env.BROKER_ALLOWED_SUBJECTS || [
            "dojot.device-manager.device",
            "device-data"]
        }
      },

      db: {
        mongodb: {
          url: process.env.MONGO_URL || "mongodb://mongodb:27017",
          options: {
              useNewUrlParser: true,
              connectTimeoutMS: 2500,
              reconnectTries: 100,
              reconnectInterval: 2500,
              autoReconnect: true,
              replicaSet: process.env.REPLICA_SET
          }
        }
      },
    },

    healthChecker: {
      timeout: {
        uptime: process.env.HC_UPTIME_TIMEOUT || 300000,
        memory: process.env.HC_MEMORY_USAGE_TIMEOUT || 300000,
        cpu: process.env.HC_CPU_USAGE_TIMEOUT || 300000,
        mongodb: process.env.HC_MONGODB_TIMEOUT || 30000,
        kafka: process.env.HC_KAFKA_TIMEOUT || 30000
      }
    },

    logger: {
      level: process.env.LOG_LEVEL || "info"
    }
};
