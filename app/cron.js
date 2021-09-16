/* eslint-disable no-useless-constructor */
const {
  ConfigManager: { getConfig },
  Kafka: { Consumer },
  Logger,
} = require('@dojot/microservice-sdk');
const util = require('util');
const { CronJob } = require('cron');
const { v4: uuidv4 } = require('uuid');
const { HttpHandler } = require('./http');
const { BrokerHandler } = require('./broker');
const { DB } = require('./db');
const { killApplication } = require('./Utils');

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
  constructor(serviceStateManager) {
    if (!serviceStateManager) {
      throw new Error('no ServiceStateManager instance was passed');
    }

    this.crontab = new Map();

    this.db = new DB();

    this.httpHandler = new HttpHandler();

    this.brokerHandler = new BrokerHandler();

    this.logger = new Logger('cron');

    this.config = getConfig('CRON');

    this.consumer = null;

    this.serviceState = serviceStateManager;

    this.wasInitialized = false;

    this.serviceName = 'kafka-consumer';
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
          const cronJobSetPromises = [];
          for (const job of jobs) {
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
          const cronJobUnsetPromises = [];
          for (const job of jobs) {
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
                      `Internal error while droping database for tenant ${tenant}`
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
        const job = new CronJob(jobSpec.time, () => {
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
        const key = this._makeKey(tenant, jobId);
        const value = { spec: jobSpec, job };
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
        reject(new InternalError('Internal error while setting up cron job.'));
      }
    });
  }

  _unSetCronJob(tenant, jobId) {
    return new Promise((resolve, reject) => {
      const key = this._makeKey(tenant, jobId);
      const value = this.crontab.get(key);
      if (value) {
        value.job.stop();
        delete value.job;
        this.crontab.delete(key);
        this.db
          .delete(tenant, jobId)
          .then(() => {
            resolve({ jobId, spec: value.spec });
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
    if (this.wasInitialized) {
      this.logger.debug(
        'Kafka Consumer already online, skipping its initialization'
      );
      return;
    }
    this.logger.info('Initializing cron service ...');

    try {
      this.consumer = new Consumer({
        ...this.config.sdkConsumer,
        'kafka.consumer': this.config.consumer,
        'kafka.topic': this.config.topic,
      });
      // Establishment of communication with the kafka
      await this.consumer.init();
      this.logger.info(
        'Communication with dojot messenger service (kafka) was established.'
      );
      // handler for broker jobs
      await this.brokerHandler.init(this.serviceState);
      this.logger.info('Handler for broker jobs was initialized.');
      // database
      await this.db.init(this.serviceState);
      this.logger.info(
        'Communication with database (mongoDB) was established.'
      );

      const topic = RegExp(
        `^.+${this.config.dojot['subjects.tenancy'].replace(/\./g, '\\.')}`
      );

      const tenantCallback = async (data) => {
        try {
          const { value: payload } = data;
          this.logger.debug(`Receiving data ${payload.toString()}`);
          const payloadObj = JSON.parse(payload);
          const { type, tenant } = payloadObj;
          switch (type) {
            case 'CREATE':
              if (!tenant) {
                this.logger.warn(
                  `CREATE - missing tenant. Received data: ${data.value.toString()}`
                );
              } else {
                await this._setTenant(tenant);
              }
              break;
            case 'DELETE':
              if (this._unsetTenant) {
                if (!tenant) {
                  this.logger.warn(
                    `DELETE - missing tenant. Received data: ${data.value.toString()}`
                  );
                } else {
                  await this._unsetTenant(tenant);
                }
              } else {
                this.logger.debug(
                  `CallbackDelete not enable. Received data: ${data.value.toString()}`
                );
              }
              break;
            default:
              this.logger.debug(
                `Event was discarded. Received data: ${data.value.toString()}`
              );
          }
        } catch (error) {
          this.logger.error(
            `(Received data - ${util.inspect(data)} - value:  ${
              data.value ? data.value.toString() : ''
            }): `,
            error
          );
        }
      };

      this.consumer.registerCallback(topic, tenantCallback);

      this.createHealthChecker();
      this.registerShutdown();
      this.wasInitialized = true;
      this.logger.info('... Kafka Consumer was initialized');
    } catch (error) {
      // something unexpected happended!
      this.logger.error(`Couldn't initialize the cron manager (${error}).`);
      killApplication();
    }
  }

  async finish() {
    try {
      this.wasInitialized = false;
      await this.consumer.finish();
      this.consumer = undefined;
    } catch (error) {
      this.logger.debug(
        'Error while finishing Kafka connection, going on like nothing happened'
      );
    }
    // this.serviceStateManager.signalNotReady('kafka-consumer');
  }

  createHealthChecker() {
    const healthChecker = async (signalReady, signalNotReady) => {
      if (this.consumer) {
        try {
          const status = await this.consumer.getStatus();
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
      await this.finish();
    });
  }

  createJob(tenant, jobSpec, jobId = null) {
    return new Promise((resolve, reject) => {
      // job id
      const _jobId = jobId || uuidv4();

      // db -job
      const dbEntry = {
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
      const key = this._makeKey(tenant, jobId);
      const value = this.crontab.get(key);
      // found
      if (value) {
        resolve({ jobId, spec: value.spec });
      }
      // not found
      else {
        reject(new JobNotFound(`Not found job ${jobId} for tenant ${tenant}`));
      }
    });
  }

  readAllJobs(tenant) {
    return new Promise((resolve) => {
      const jobs = [];
      for (const [key, value] of this.crontab) {
        const [_tenant, jobId] = key.split(':');
        if (_tenant === tenant) {
          jobs.push({ jobId, spec: value.spec });
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
    const deleteJobPromises = [];
    for (const [key] of this.crontab) {
      const [_tenant, jobId] = key.split(':');
      if (_tenant === tenant) {
        deleteJobPromises.push(this.deleteJob(tenant, jobId));
      }
    }
    return Promise.all(deleteJobPromises);
  }
}

module.exports = {
  JobNotFound,
  InternalError,
  CronManager,
};
