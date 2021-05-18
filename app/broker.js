/* eslint-disable no-useless-constructor */
const {
  ConfigManager: { getConfig },
  Kafka: { Producer },
  Logger,
} = require('@dojot/microservice-sdk');
const { killApplication } = require('./Utils');

// Errors ...
class InitializationFailed extends Error {
  constructor(...args) {
    super(...args);
  }
}

class InvalidSubject extends Error {
  constructor(...args) {
    super(...args);
  }
}

class InvalidTenant extends Error {
  constructor(...args) {
    super(...args);
  }
}

class InternalError extends Error {
  constructor(...args) {
    super(...args);
  }
}
// ... Errors

class BrokerHandler {
  constructor() {
    this.config = getConfig('CRON');
    this.allowedSubjects = this.config.actions['broker.allowed.subjects'];
    this.producer = null;
    this.serviceState = null;
    this.logger = new Logger('broker');
    this.serviceName = 'kafka-producer';
    this.logger.info(
      `Broker handler can publish to subjects: ${this.allowedSubjects}`
    );
  }

  async init(serviceStateManager) {
    try {
      this.producer = new Producer({
        ...this.config.sdkProducer,
        'kafka.producer': this.config.producer,
        'kafka.topic': this.config.topic,
      });
      this.logger.info('Initializing Kafka Producer...');
      await this.producer.connect();
      this.serviceState = serviceStateManager;
      this.createHealthChecker();
      this.registerShutdown();
      this.logger.info('... Kafka Producer was initialized');
    } catch (error) {
      this.logger.error(
        'An error occurred while initializing the Agent Messenger. Bailing out!'
      );
      this.logger.error(error.stack || error);
      killApplication();
    }
  }

  createHealthChecker() {
    const healthChecker = async (signalReady, signalNotReady) => {
      if (this.producer) {
        try {
          const status = await this.producer.getStatus();
          if (status.connected) {
            signalReady();
          } else {
            signalNotReady();
          }
        } catch (error) {
          signalNotReady();
        }
      } else {
        signalNotReady();
      }
    };
    this.serviceState.addHealthChecker(
      this.serviceName,
      healthChecker,
      this.config.healthChecker['kafka.interval.ms']
    );
  }

  registerShutdown() {
    this.serviceState.registerShutdownHandler(async () => {
      this.logger.warn('Shutting down Kafka connection...');
      return this.producer.disconnect();
    });
  }

  static formatMessage(tenant, subject, message) {
    const formatedMessage = message;
    // from dojot to device
    if (subject === 'dojot.device-manager.device') {
      // overwrite tenant, timestamp
      formatedMessage.meta.service = tenant;
      formatedMessage.meta.timestamp = Date.now();
    }
    // from device to dojot
    else if (subject === 'device-data') {
      // overwrite tenant, timestamp
      formatedMessage.metadata.tenant = tenant;
      formatedMessage.metadata.timestamp = Date.now();
    }
    return formatedMessage;
  }

  send(tenant, req) {
    return new Promise((resolve, reject) => {
      try {
        let message;
        // format message
        try {
          message = this.formatMessage(tenant, req.subject, req.message);
        } catch (error) {
          this.logger.warn(
            `Failed formatting message ${JSON.stringify(req.message)} ` +
              `to ${tenant}/${req.subject}`
          );
          return;
        }

        // publish
        const kafkaTopic = `${tenant}.${req.subject}`;
        const deviceDataMessage = JSON.stringify(message);

        this.logger.debug(
          `Trying to send message to kafka topic ${kafkaTopic}...`
        );
        this.producer.produce(kafkaTopic, deviceDataMessage).then(() => {
          this.logger.debug(
            `Successfully sent message to Kafka in ${kafkaTopic}`
          );
        });

        this.logger.debug(
          `Published message ${JSON.stringify(req.message)} to ${tenant}/${
            req.subject
          }`
        );
        resolve();
        return;
      } catch (error) {
        this.logger.debug(
          `Failed to publish message to ${tenant}/${req.subject} (${error}).`
        );
        reject(
          new InternalError(
            `Internal Error while publishing message to ${tenant}/${req.subject}`
          )
        );
      }
    });
  }
}

module.exports = {
  InitializationFailed,
  InvalidTenant,
  InvalidSubject,
  InternatlError: InternalError,
  BrokerHandler,
};
