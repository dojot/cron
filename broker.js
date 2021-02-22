"use strict";

const logger = require("@dojot/dojot-module-logger").logger;
const config = require('./config');

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
    constructor(messenger) {
        this.dojotMessenger = messenger;
        this.allowedSubjects = config.cronManager.actions.broker.allowedSubjects;
        logger.info(`Broker handler can publish to subjects: ${this.allowedSubjects}`);
    }

    init() {
        return new Promise((resolve, reject) => {
            try{
                for(let subject of this.allowedSubjects) {
                    this.dojotMessenger.createChannel(subject, "w", false);
                    logger.info(`Created writable channel for subject ${subject}.`);
                }

                resolve();
            }
            catch(error) {
                logger.error(`Failed to configure channels in dojot messenger (${error}).`);
                reject(new InitializationFailed(`Broker handler couldn't be initialized.`));
            }
        });
    }

    status() {
        return new Promise((resolve, reject) => {
            let brokerStatus = {
                connected: false
            };
            this.dojotMessenger.producer.producer.getMetadata({timeout: 3000},
                (error, metadata) => {
                    if (error) {
                        logger.error(`Failed to get kafka metadata (${error}).`);
                        reject(new InternalError('Internal error while getting kafka metadata.'));
                    }
                    else {
                        brokerStatus.connected = true;
                        brokerStatus.details = {
                            producer: {
                                metadata: metadata
                            }
                        }
                        resolve(brokerStatus);
                    }
              });
        });
    }

    _isTenantValid(tenant) {
        return (this.dojotMessenger.tenants.find(t => t === tenant) ? true : false);
    }

    _isSubjectValid(subject) {
        return (this.allowedSubjects.find(s => s === subject) ? true : false);
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
                // The messenger method for publishing to kafka
                // logs error conditions, but doesn't return them.
                // It is some like silent.

                // validate tenant
                if(!this._isTenantValid(tenant)) {
                    logger.debug(`Failed to publish message (Invalid Tenant).`);
                    reject(new InvalidTenant(`Broker handler doesn't know tenant ${tenant}`));
                    return;
                }

                // validate subject
                if(!this._isSubjectValid(req.subject)) {
                    logger.debug(`Failed to publish message (Invalid Subject)`);
                    reject(new InvalidSubject(`Broker handler doesn't know subject ${req.subject}`));
                    return;
                }

                // validate message
                // TODO

                // format message
                try {
                    this._formatMessage(tenant, req.subject, req.message);
                }
                catch (error) {
                    logger.warn(`Failed formatting message ${JSON.stringify(req.message)} `
                    + `to ${tenant}/${req.subject}`);
                    return;
                }

                // publish
                this.dojotMessenger.publish(req.subject, tenant, JSON.stringify(req.message));
                logger.debug(`Published message ${JSON.stringify(req.message)} to ${tenant}/${req.subject}`);
                resolve();
                return;
            }
            catch (error) {
                logger.debug(`Failed to publish message to ${tenant}/${req.subject} (${error}).`);
                reject(new InternalError(`Internal Error while publishing message to ${tenant}/${req.subject}`));
            }
        });
    }
}

module.exports = {
    InitializationFailed: InitializationFailed,
    InvalidTenant: InvalidTenant,
    InvalidSubject: InvalidSubject,
    InternatlError: InternalError,
    BrokerHandler: BrokerHandler
};