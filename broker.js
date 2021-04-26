"use strict";

const {
  ConfigManager: { getConfig },
  Kafka: { Producer },
  Logger,
} = require("@dojot/microservice-sdk");

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
  constructor(serviceStateManager) {
    this.config = getConfig('CRON');
    
    this.allowedSubjects = this.config.actions['broker.allowedSubjects'];

    this.producer = null;

    this.serviceStateManager = serviceStateManager;

    // logger
    this.logger = new Logger('broker');
    this.logger.info(
      `Broker handler can publish to subjects: ${this.allowedSubjects}`
    );
  }

  async init() {
    this.producer = new Producer({
        ...this.config.sdkProducer,
        'kafka.producer': this.config.producer,
        'kafka.topic': this.config.topic,
      });

    this.logger.info('Initializing Kafka Producer...');
    await this.producer
      .connect()
      .then(() => {
        this.logger.info('... Kafka Producer was initialized');
      })
      .catch((error) => {
        this.logger.error(
          'An error occurred while initializing the Agent Messenger. Bailing out!'
        );
        this.logger.error(error.stack || error);
        process.exit(1);
      });
  }

  async finish() {
    try {
      await this.producer.finish();
      this.producer = undefined;
    } catch (error) {
      this.logger.debug(
        "Error while finishing Kafka connection, going on like nothing happened"
      );
    }
    this.serviceStateManager.signalNotReady("kafka-broker");
  }

  async healthChecker(signalReady, signalNotReady) {
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
  }

  async shutdownHandler() {
    this.logger.warn("Shutting down Kafka connection...");
    await this.finish();
  }

  _formatMessage(tenant, subject, message) {
    // from dojot to device
    if (subject === 'dojot.device-manager.device') {
      // overwrite tenant, timestamp
      message.meta.service = tenant;
      message.meta.timestamp = Date.now();
    }
    // from device to dojot
    else if (subject === 'device-data') {
      // overwrite tenant, timestamp
      message.metadata.tenant = tenant;
      message.metadata.timestamp = Date.now();
    }
    return message;
  }

  send(tenant, req) {
    return new Promise((resolve, reject) => {
      try {
        let message;
        // format message
        try {
          message = this._formatMessage(tenant, req.subject, req.message);
        } catch (error) {
          this.logger.warn(
            `Failed formatting message ${JSON.stringify(req.message)} ` +
              `to ${tenant}/${req.subject}`
          );
          return;
        }

        // publish
        let kafkaTopic = `${tenant}.${req.subject}`;
        let deviceDataMessage = JSON.stringify(message);

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
  InitializationFailed: InitializationFailed,
  InvalidTenant: InvalidTenant,
  InvalidSubject: InvalidSubject,
  InternatlError: InternalError,
  BrokerHandler: BrokerHandler,
};
