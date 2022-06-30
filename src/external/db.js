/* eslint-disable no-useless-constructor */
/* eslint-disable max-classes-per-file */
const {
  MongoClient: { connect },
} = require('mongodb');
const {
  ConfigManager: { getConfig, transformObjectKeys },
  Logger,
} = require('@dojot/microservice-sdk');
const camelCase = require('lodash.camelcase');
const { objectRenameKey, killApplication } = require('../Utils');

// Errors ...
class DatabaseNotFound extends Error {
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

class DB {
  constructor() {
    this.client = null;
    this.databases = new Map();
    this.logger = new Logger('db');
    this.config = getConfig('CRON');
    this.serviceName = 'db-cron';
  }

  async init(serviceStateManager) {
    try {
      const optionsCamelCase = transformObjectKeys(
        this.config.options,
        camelCase
      );
      const options = objectRenameKey(
        optionsCamelCase,
        'connectTimeoutMs',
        'connectTimeoutMS'
      );
      this.client = await connect(this.config.db['mongodb.url'], options);
      this.serviceState = serviceStateManager;
      this.createHealthChecker();
      this.registerShutdown();
    } catch (error) {
      this.logger.debug('An error occurred while initializing DB', error);
      killApplication();
    }
  }

  createHealthChecker() {
    const healthChecker = async (signalReady, signalNotReady) => {
      if (this.client) {
        try {
          const status = await this.status();
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
      this.logger.warn('Shutting down MongoDB connection...');
      await this.client.close();
      this.client = null;
    });
  }

  status() {
    return new Promise((resolve, reject) => {
      const dbStatus = {
        connected: false,
      };
      const isConnected = this.client.isConnected();
      if (isConnected) {
        dbStatus.connected = true;

        const dbStatsPromises = [];
        for (const entry of this.databases.values()) {
          dbStatsPromises.push(entry.db.stats());
        }
        Promise.all(dbStatsPromises)
          .then((allDbStats) => {
            dbStatus.details = allDbStats;
            resolve(dbStatus);
          })
          .catch((error) => {
            this.logger.debug(`Failed to get database status (${error})`);
            dbStatus.connected = false;
            reject(
              new InternalError(`Internal error while getting database status.`)
            );
          });
      } else {
        resolve(dbStatus);
      }
    });
  }

  createDatabase(tenant) {
    const key = tenant;
    const db = this.client.db(`cron_${tenant}`);
    const collection = db.collection('jobs');
    this.logger.info(
      `Created collection jobs into database ${`cron_${tenant}`}.`
    );
    const entry = {
      db,
      collection,
    };
    this.databases.set(key, entry);
    this.logger.debug(`Cached database clients for tenant ${tenant}.`);
  }

  deleteDatabase(tenant) {
    const key = tenant;
    const entry = this.databases.get(key);
    if (entry) {
      entry.db.dropDatabase();
      this.logger.info(`Droped database ${`cron_${tenant}`}.`);
      this.databases.delete(key);
    } else {
      this.logger.debug(
        `Nothing to be unset. Database doesn't exist for tenant ${tenant}.`
      );
      throw new DatabaseNotFound(`Not found database for tenant ${tenant}.`);
    }
  }

  create(tenant, job) {
    // promise
    return this.databases.get(tenant).collection.insertOne(job);
  }

  readAll(tenant) {
    // promise
    return this.databases.get(tenant).collection.find().toArray();
  }

  read(tenant, jobId) {
    // promise
    return this.databases.get(tenant).collection.findOne({ jobId });
  }

  update(tenant, job) {
    // promise
    return this.databases
      .get(tenant)
      .collection.replaceOne({ jobId: job.jobId }, job);
  }

  delete(tenant, jobId) {
    // promise
    return this.databases.get(tenant).collection.deleteOne({ jobId });
  }
}

module.exports = {
  DatabaseNotFound,
  InternatlError: InternalError,
  DB,
};
