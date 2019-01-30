"use strict";

const CronJob = require('cron').CronJob;
const uuidv4 = require('uuid/v4');
//const vm = require('vm');
const http = require('./http');
const broker = require('./broker');

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

        // http handler
        this.httpHandler = new http.HttpHandler();

        // broker handler
        this.brokerHandler = new broker.BrokerHandler();

        // context
        // TODO: a context for each job
        //this.context = vm.createContext();
    }

    _makeKey(tenant, jobId) {
        return `${tenant}:${jobId}`;
    }

    init() {
        console.debug('Initializing cron service ...');
        return new Promise((resolve, reject) => {
            // start data broker
            this.brokerHandler.init().then(() => {
                console.info('Communitation to data-broker established.')

                //db
                // TODO

                resolve();

            }).catch(error => {
                console.error(`Couldn't initialize the cron service (${error})`);
                reject(new InternalError('Internat Error.'));
            });
        });
    }

    createJob(tenant, jobSpec) {
        return new Promise((resolve, reject) => {
            try {
                // job id
                let jobId = uuidv4();

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
                            console.debug(`... Failed to execute job ${jobId} (error)`);
                        });
                    }

                    // TODO
                    // jscode action
                    //if (jobSpec.jscode) {
                    //    let script = new vm.Script(jobSpec.jscode);
                    //    script.runInContext(this.context);
                    //}
                });

                // cache
                let  key = this._makeKey(tenant, jobId);
                let value = {spec: jobSpec, job: job};
                this.crontab.set(key, value); 

                // db
                // TODO

                // start job
                job.start();
                
                console.info(`Succeeded to schedule job ${JSON.stringify(jobSpec)}`);

                resolve(jobId);
            }
            catch(ex) {
                console.warn(`Failed to schedule job ${Json.stringify(jobSpec)} (${ex})`);
                reject(new InternalError('Internal Error'));
            }
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

/*
    updateJob(tenant, jobId, jobSpec) {
        return new Promise((resolve, reject) => {
            let key = this._makeKey(tenant, jobId);
            let value = this.crontab.get(key);
            // found
            if(value){
                try {
                    // discard old job
                    value.job.stop();
                    delete value.job;

                    // cron job
                    let job = new CronJob(jobSpec.time, () => {
                        console.debug(`Executing job ${util.inspect(jobSpec, {depth: null})} ...`);            
                        // TODO: execute the job
                    });
                    
                    // cache
                    value.job = job;
                    this.crontab.set(key, value);
                    
                    // db
                    // TODO

                    // start job
                    job.start();
                    resolve(jobId);
                }
                catch(ex) {
                    console.debug(`Got exception ${ex}`);
                    reject(ex);
                }
            }
            // not found
            else {

            }
        });

    }*/

    deleteJob(tenant, jobId) {
        return new Promise((resolve, reject) => {
            let key = this._makeKey(tenant, jobId);
            let value = this.crontab.get(key);
            if(value){
                console.log(`key ${key} spec ${value.spec}`);
                value.job.stop();
                delete value.job;
                this.crontab.delete(key);
                resolve({jobId: jobId, spec: value.spec});
            }
            else {
                console.log(`key ${key}`);
                reject(new JobNotFound(`Not found job ${jobId} for tenant ${tenant}`));
            }
        });
    }
}

module.exports = {
    JobNotFound: JobNotFound,
    InternatlError: InternalError,
    CronManager: CronManager
};