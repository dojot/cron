"use strict";

const {
  Kafka: { Consumer },
  Logger,
} = require("@dojot/microservice-sdk");
const CronJob = require("cron").CronJob;
const uuidv4 = require("uuid/v4");
const http = require("./http");
const broker = require("./broker");
const config = require("./config");
const DB = require("./db").DB;

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

    // // dojot messenger
    // this.dojotMessenger = new dojotModule.Messenger(
    //   'cron',
    //   config.kafkaMessenger
    // );

    // database
    this.db = new DB();

    // http handler
    this.httpHandler = new http.HttpHandler();

    // broker handler
    this.brokerHandler = new broker.BrokerHandler();

    // logger
    this.logger = new Logger('cron');

    this.consumer = new Consumer({
      ...config.sdk,
      'kafka.consumer': config.kafkaMessenger.kafka.consumer,
      'kafka.topic': config.kafkaMessenger.kafka.topic,
    });

    this.idCallbackTenant = null;
  }

  _makeKey(tenant, jobId) {
    return `${tenant}:${jobId}`;
  }

  _setTenant(tenant) {
    return new Promise((resolve, reject) => {
      // create database for this tenant if it hasn't been done yet
      this.db.createDatabase(tenant);

      // load existing jobs for the corresponding tenant
      this.db
        .readAll(tenant)
        .then((jobs) => {
          let cronJobSetPromises = [];
          for (let job of jobs) {
            cronJobSetPromises.push(
              this._setCronJob(tenant, job.jobId, job.spec)
            );
          }

          Promise.all(cronJobSetPromises)
            .then(() => {
              this.logger.info(
                `Succeeded to set cron jobs for tenant ${tenant}.`
              );
              resolve();
            })
            .catch((error) => {
              this.logger.error(
                `Failed to set cron jobs for ${tenant} (${error}).`
              );
              reject(
                new InternalError(
                  `Internal error while setting cron jobs for tenant ${tenant}.`
                )
              );
            });
        })
        .catch((error) => {
          this.logger.error(
            `Failed to read cron jobs from database for ${tenant} (${error}).`
          );
          reject(
            new InternalError(
              `Internal error while reading cron jobs from database for tenant ${tenant}.`
            )
          );
        });
    });
  }

  _unsetTenant(tenant) {
    return new Promise((resolve, reject) => {
      // stop existing jobs for the corresponding tenant
      this.db
        .readAll(tenant)
        .then((jobs) => {
          let cronJobUnsetPromises = [];
          for (let job of jobs) {
            cronJobUnsetPromises.push(this._unsetCronJob(tenant, job.jobId));
          }

          Promise.all(cronJobUnsetPromises)
            .then(() => {
              this.logger.info(
                `Succeeded to remove cron jobs for tenant ${tenant}.`
              );

              this.db
                .deleteDatabase(tenant)
                .then(() => {
                  this.logger.info(
                    `Succeeded to drop database for tenant ${tenant}.`
                  );
                  resolve();
                })
                .catch((error) => {
                  this.logger.error(
                    `Failed to drop database for ${tenant} (${error}).`
                  );
                  reject(
                    new InternalError(
                      `Internal error while droping database for tenant ${tenat}`
                    )
                  );
                });
            })
            .catch((error) => {
              this.logger.error(
                `Failed to remove cron jobs for ${tenant} (${error}).`
              );
              reject(
                new InternalError(
                  `Internal error while removing cron jobs for tenant ${tenant}.`
                )
              );
            });
        })
        .catch((error) => {
          this.logger.error(
            `Failed to read cron jobs from database for ${tenant} (${error}).`
          );
          reject(
            new InternalError(
              `Internal error while reading cron jobs from database for tenant ${tenant}.`
            )
          );
        });
    });
  }

  _setCronJob(tenant, jobId, jobSpec) {
    return new Promise((resolve, reject) => {
      try {
        // cron job
        let job = new CronJob(jobSpec.time, () => {
          this.logger.debug(`Executing cron job ${jobId} ...`);

          // http action
          if (jobSpec.http) {
            this.httpHandler
              .send(tenant, jobSpec.http)
              .then(() => {
                this.logger.debug(
                  `... Succeeded to execute cron job ${jobId}.`
                );
              })
              .catch((error) => {
                // TODO: generate notification
                this.logger.debug(
                  `... Failed to execute cron job ${jobId} (${error}).`
                );
              });
          }

          // broker action
          if (jobSpec.broker) {
            this.brokerHandler
              .send(tenant, jobSpec.broker)
              .then(() => {
                this.logger.debug(
                  `... Succeeded to execute cron job ${jobId}.`
                );
              })
              .catch((error) => {
                // TODO: generate notification
                this.logger.debug(
                  `... Failed to execute cron job ${jobId} (${error}).`
                );
              });
          }
        });

        // cache
        let key = this._makeKey(tenant, jobId);
        let value = { spec: jobSpec, job: job };
        this.crontab.set(key, value);

        // start job
        job.start();
        this.logger.info(
          `Succeeded to set up cron job ${jobId} with spec ${JSON.stringify(
            jobSpec
          )}.`
        );

        resolve();
      } catch (error) {
        this.logger.error(
          `Failed to set up cron job ${jobId} with spec ${JSON.stringify(
            jobSpec
          )} (${error}).`
        );
        reject(new InternalError(`Internal error while setting up cron job.`));
      }
    });
  }

  _unSetCronJob(tenant, jobId) {
    return new Promise((resolve, reject) => {
      let key = this._makeKey(tenant, jobId);
      let value = this.crontab.get(key);
      if (value) {
        value.job.stop();
        delete value.job;
        this.crontab.delete(key);
        this.db
          .delete(tenant, jobId)
          .then(() => {
            resolve({ jobId: jobId, spec: value.spec });
          })
          .catch((error) => {
            this.logger.error(`Failed to unset cron job ${jobId} (${error}).`);
            reject(
              new InternalError(
                `Internal error while unsetting cron job ${jobId}.`
              )
            );
          });

        this.logger.info(`Succeeded to unset cron job ${jobId}.`);
      } else {
        this.logger.debug(`Not found job ${jobId} for tenant ${tenant}`);
        reject(new JobNotFound(`Not found job ${jobId} for tenant ${tenant}`));
      }
    });
  }

  async init() {
    this.logger.info('Initializing cron service ...');

    // init consumer
    return await this.consumer
      .init()
      .then(() => {
        this.logger.info(
          'Communication with dojot messenger service (kafka) was established.'
        );
        return this.brokerHandler.init();
        // handler for broker jobs
      })
      .then(() => {
        this.logger.info('Handler for broker jobs was initialized.');
        //database
        return this.db.init();
      })
      .then(async () => {
        this.logger.info(
          'Communication with database (mongoDB) was established.'
        );

        const topic = new RegExp(
          `^.+${config.kafkaMessenger.dojot.subjects.tenancy.replace(
            /\./g,
            '\\.'
          )}`
        );

        this.idCallbackTenant = this.consumer.registerCallback(
          topic,
          async (data) => {
            try {
              const { value: payload } = data;
              this.logger.debug(
                `registerCallbackForTenantEvents: Receiving data ${payload.toString()}`
              );
              const payloadObj = JSON.parse(payload);
              const { type, tenant } = payloadObj;
              switch (type) {
                case 'CREATE':
                  if (!tenant) {
                    this.logger.warn(
                      `registerCallbackForTenantEvents: CREATE - missing tenant. Received data: ${data.value.toString()}`
                    );
                  } else {
                    await this._setTenant(tenant);
                  }
                  break;
                case 'DELETE':
                  if (this._unsetTenant) {
                    if (!tenant) {
                      this.logger.warn(
                        `registerCallbackForTenantEvents: DELETE - missing tenant. Received data: ${data.value.toString()}`
                      );
                    } else {
                      await this._unsetTenant(tenant);
                    }
                  } else {
                    this.logger.debug(
                      `registerCallbackForTenantEvents: callbackDelete not enable. Received data: ${data.value.toString()}`
                    );
                  }
                  break;
                default:
                  this.logger.debug(
                    `registerCallbackForTenantEvents: event was discarded. Received data: ${data.value.toString()}`
                  );
              }
            } catch (e) {
              this.logger.error(
                `registerCallbackForTenantEvents (Received data - ${util.inspect(
                  data
                )} - value:  ${data.value ? data.value.toString() : ''}): `,
                e
              );
            }
          }
        );
        
        // // tenancy channel
        // this.dojotMessenger.createChannel(
        //     config.kafkaMessenger.dojot.subjects.tenancy, 'r', true /*global*/);
        // this.logger.info('Read-only channel for tenancy events was created.');

        // // tenancy channel: new-tenant event
        // this.dojotMessenger.on(config.kafkaMessenger.dojot.subjects.tenancy,
        //     config.kafkaMessenger.dojot.events.tenantEvent.NEW_TENANT, (_tenant, newtenant) => {
        //         this._setTenant(newtenant);
        // });

        // let tenantSetPromises = [];
        // for (let tenant of this.dojotMessenger.tenants) {
        //   tenantSetPromises.push(this._setTenant(tenant));
        // }
        // return Promise.all(tenantSetPromises);
      })
      .catch((error) => {
        // something unexpected happended!
        this.logger.error(`Couldn't initialize the cron manager (${error}).`);
        return Promise.reject(
          new InternalError('Internal error while starting cron manager.')
        );
      });
  }

  createJob(tenant, jobSpec, jobId = null) {
    return new Promise((resolve, reject) => {
      // job id
      let _jobId = jobId || uuidv4();

      // db -job
      let dbEntry = {
        jobId: _jobId,
        spec: jobSpec,
      };
      this.db
        .create(tenant, dbEntry)
        .then(() => {
          this._setCronJob(tenant, _jobId, jobSpec)
            .then(() => {
              resolve(_jobId);
            })
            .catch((error) => {
              this.logger.debug(`Couldn't set cron job (${error}).`);
              reject(
                new InternalError('Internal error while setting cron job.')
              );
            });
        })
        .catch((error) => {
          this.logger.debug(`Couldn't create cron job (${error}).`);
          reject(new InternalError('Internal error while creating cron job.'));
        });
    });
  }

  readJob(tenant, jobId) {
    return new Promise((resolve, reject) => {
      let key = this._makeKey(tenant, jobId);
      let value = this.crontab.get(key);
      // found
      if (value) {
        resolve({ jobId: jobId, spec: value.spec });
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
      for (let [key, value] of this.crontab) {
        let [_tenant, jobId] = key.split(':');
        if (_tenant === tenant) {
          jobs.push({ jobId: jobId, spec: value.spec });
        }
      }
      resolve(jobs);
    });
  }

  deleteJob(tenant, jobId) {
    // promise
    return this._unSetCronJob(tenant, jobId);
  }

  deleteAllJobs(tenant) {
    let deleteJobPromises = [];
    for (let [key] of this.crontab) {
      let [_tenant, jobId] = key.split(':');
      if (_tenant === tenant) {
        deleteJobPromises.push(this.deleteJob(tenant, jobId));
      }
    }
    return Promise.all(deleteJobPromises);
  }
}

module.exports = {
  JobNotFound: JobNotFound,
  InternalError: InternalError,
  CronManager: CronManager,
};
