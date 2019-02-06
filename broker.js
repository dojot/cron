"use strict";

const dojotModule = require('@dojot/dojot-module');
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
    constructor() {
        this.kafkaMessenger = new dojotModule.Messenger('cron', config.kafkaMessenger);
        this.allowedSubjects = config.cronManager.broker.allowedSubjects;
        console.info(`Allowed subjects: ${this.allowedSubjects}`);
    }

    init() {
        return this.kafkaMessenger.init().then(() => {
            for(let subject of this.allowedSubjects) {
                this.kafkaMessenger.createChannel(subject, "w", false);
                console.info(`Created writable channel for subject ${subject}`);
            }
        }).catch(error => {
            console.error(`Failed to initialize Data Broker (${error})`);
            throw new InitializationFailed();
        });
    }

    _isTenantValid(tenant) {
        return (this.kafkaMessenger.tenants.find(t => t === tenant) ? true : false);
    }

    _isSubjectValid(subject) {
        return (this.allowedSubjects.find(s => s === subject) ? true : false);
    }

    send(tenant, req) {
        return new Promise((resolve, reject) => {
            try {
                // The messenger method for publishing to kafka 
                // logs error conditions, but doesn't return them.
                // It is some like silent. 

                // validate tenant
                if(!this._isTenantValid(tenant)) {
                    console.warn(`Failed to publish message (Invalid Tenant)`);
                    reject(new InvalidTenant(`Broker doesn't know tenant ${tenant}`));
                    return;
                }

                // validate subject
                if(!this._isSubjectValid(req.subject)) {
                    console.warn(`Failed to publish message (Invalid Subject)`);
                    reject(new InvalidSubject(`Broker doesn't know subject ${req.subject}`));
                    return;
                }

                // validate message
                // TODO

                // publish
                this.kafkaMessenger.publish(req.subject, tenant, JSON.stringify(req.message));
                console.debug(`Published message ${JSON.stringify(req.message)} to ${tenant}/${req.subject}`);

                resolve();
            }
            catch (ex) {
                console.warn(`Failed to publish message (${ex}) to ${tenant}/${req.subject}`);
                reject(new InternalError('Internal Error'));
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