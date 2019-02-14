"use strict";

const dojotModule = require('@dojot/dojot-module');
const CronJob = require('cron').CronJob;
const uuidv4 = require('uuid/v4');
const http = require('./http');
const broker = require('./broker');
const config = require('./config');
const DB = require('./db').DB;

// Errors ...
class JobNotFound extends Error {
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

class CronManager {

    constructor() {
        // cache
        this.crontab = new Map();

        // dojot messenger
        this.dojotMessenger = new dojotModule.Messenger('cron', config.kafkaMessenger);

        // database
        this.db = new DB();

        // http handler
        this.httpHandler = new http.HttpHandler(this.dojotMessenger);

        // broker handler
        this.brokerHandler = new broker.BrokerHandler(this.dojotMessenger);
    }

    _makeKey(tenant, jobId) {
        return `${tenant}:${jobId}`;
    }

    _setTenant(tenant) {
        return new Promise((resolve, reject) => {
            // setup tenant in database if it hasn't been done yet
            this.db.setTenant(tenant);

            // load existing jobs for the corresponding tenant
            this.db.readAll(tenant).then((jobs) => {

                let cronJobSetPromises = [];
                for(let job of jobs) {
                    cronJobSetPromises.push(this._setCronJob(tenant, job.jobId, job.spec));
                }

                Promise.all(cronJobSetPromises).then(() => {
                    console.info(`Support for tenant ${tenant} was configured.`);
                    resolve();
                }).catch(error => {
                    console.error(`Failed to set cron jobs for ${tenant} (${error}).`);
                    reject(new InternalError(`Internat error while setting cron jobs for tenant ${tenant}.`));
                });

            }).catch((error) => {
                console.error(`Failed to read jobs from database for ${tenant} (${error}).`);
                reject(new InternalError(`Internat error while reading jobs for tenant ${tenant}.`));
            });
        });
    }

    _unsetTenant(tenant) {
        return new Promise((resolve, reject) => {
            // stop existing jobs for the corresponding tenant
            this.db.readAll(tenant).then((jobs) => {
            
                let cronJobUnsetPromises = [];
                for(let job of jobs) {
                    cronJobUnsetPromises.push(this._unsetCronJob(tenant, job.jobId));
                }

                Promise.all(cronJobUnsetPromises).then(() => {
                    console.info(`Support for tenant ${tenant} was removed.`);
                    resolve();
                }).catch(error => {
                    console.error(`Failed to remove cron jobs for ${tenant} (${error}).`);
                    reject(new InternalError(`Internat error while removing cron jobs for tenant ${tenant}.`));
                });

            }).catch(error => {
                console.error(`Failed to read jobs from database for ${tenant} (${error}).`);
                reject(new InternalError(`Internat error while reading jobs for tenant ${tenant}.`));
            });
        });
    }

    _setCronJob(tenant, jobId, jobSpec) {
        return new Promise((resolve, reject) => {
            try {
                // cron job
                let job = new CronJob(jobSpec.time, () => {
                    console.debug(`Executing job ${jobId} ...`);            
                    
                    // http action
                    if (jobSpec.http) {
                        this.httpHandler.send(tenant, jobSpec.http).then(() => {
                            console.debug(`... Succeeded to execute job ${jobId}`);
                        }).catch(error => {
                            console.log(error);
                            // TODO: generate notification
                            console.debug(`... Failed to execute job ${jobId}`);
                        });
                    }

                    // broker action
                    if (jobSpec.broker) {
                        this.brokerHandler.send(tenant, jobSpec.broker).then(() => {
                            console.debug(`... Succeeded to execute job ${jobId}`);
                        }).catch(error => {
                            // TODO: generate notification
                            console.debug(`... Failed to execute job ${jobId} (${error})`);
                        });
                    }
                });

                // cache
                let  key = this._makeKey(tenant, jobId);
                let value = {spec: jobSpec, job: job};
                this.crontab.set(key, value);

                // start job
                job.start();

                console.info(`Started job ${jobId} with spec ${jobSpec}.`);
                resolve();
            }
            catch(error) {
                console.error(`Failed to set up cron job ${jobId} (${error}).`);
                reject(new InternalError(`Internal error while setting up cron job ${jobId}`));
            }
        });
    }

    _unSetCronJob(tenant, jobId) {
        return new Promise((resolve, reject) => {
            let key = this._makeKey(tenant, jobId);
            let value = this.crontab.get(key);
            if(value){
                value.job.stop();
                delete value.job;
                this.crontab.delete(key);
                this.db.delete(tenant, jobId).then(() => {
                    resolve({jobId: jobId, spec: value.spec});
                }).catch(error => {
                    console.error(`Failed to remove job ${jobId} from database (${error}).`);
                    reject(new InternalError(`Internal error while removing job ${jobId} from database.`));
                });
            }
            else {
                reject(new JobNotFound(`Not found job ${jobId} for tenant ${tenant}`));
            }
        });
    }

    init() {
        console.debug('Initializing cron service ...');
        
        // dojot messenger
        return this.dojotMessenger.init().then(()=>{
            console.info('Communication with dojot messenger service (kafka) was established.');
            return this.brokerHandler.init();
        // handler for broker jobs
        }).then(() => {
            console.info('Handler for broker jobs was initialized.');
            return this.db.init();
        //database
        }).then(()=> {
            console.info('Communication with database was established.');

            // tenancy channel
            this.dojotMessenger.createChannel(
                config.kafkaMessenger.dojot.subjects.tenancy, "r", true /*global*/);
            console.info('Read-only channel for tenancy events was created.');

            // tenancy channel: new-tenant event
            this.dojotMessenger.on(config.kafkaMessenger.dojot.subjects.tenancy, 
                'new-tenant', (tenant, newtenant) => {
                    this._setTenant();
            });
            
            let tenantSetPromises = [];
            for(let tenant of this.dojotMessenger.tenants) {
                tenantSetPromises.push(this._setTenant(tenant));
            }
            return Promise.all(tenantSetPromises);      
        }).catch(error => {
            // something unexpected happended!
            console.error(`Couldn't initialize the cron service (${error})`);
            return Promise.reject(new InternalError('Internal error while starting cron manager.'));
        });
    }

    createJob(tenant, jobSpec) {
        return new Promise((resolve, reject) => {
            // job id
            let jobId = uuidv4();

            // db -job
            let dbEntry = {
                jobId: jobId,
                spec: jobSpec
            };
            this.db.create(tenant, dbEntry).then(() => {
                this._setCronJob(tenant, jobId, jobSpec).then(() => {
                    console.info(`Succeeded to schedule job ${JSON.stringify(jobSpec)}`);
                    resolve(jobId);
                });
            }).catch(error => {
                console.warn(`Failed to schedule job ${Json.stringify(jobSpec)} (${error})`);
                reject(new InternalError('Internal error while creating job.'));
            });
        });
    }

    readJob(tenant, jobId) {
        return new Promise((resolve, reject) => {
            let key = this._makeKey(tenant, jobId);
            let value = this.crontab.get(key);
            // found
            if (value) {
                resolve({jobId: jobId, spec: value.spec});
            }
            // not found
            else {
                reject(new JobNotFound(`Not found job ${jobId} for tenant ${tenant}`));
            }
        });
    }

    readAllJobs(tenant) {
        return new Promise((resolve) => {
            let jobs = [];
            for(let [key, value] of this.crontab) {
                let [_tenant, jobId] = key.split(':');
                if(_tenant === tenant) {
                    jobs.push({jobId: jobId, spec: value.spec});
                }
            }
            resolve(jobs);
        });
    }

    deleteJob(tenant, jobId) {
        // promise
        return this._unSetCronJob(tenant, jobId);
    }
}

module.exports = {
    JobNotFound: JobNotFound,
    InternatlError: InternalError,
    CronManager: CronManager
};