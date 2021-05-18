'use strict';

const {
  MongoClient: { connect },
} = require('mongodb');
const {
  ConfigManager: { getConfig, transformObjectKeys },
  Logger,
} = require('@dojot/microservice-sdk');
const { objectRenameKey } = require('./Utils');
const camelCase = require('lodash.camelcase');

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
  constructor(serviceStateManager) {
    this.client = null;
    this.databases = new Map();
    this.serviceStateManager = serviceStateManager;
    this.logger = new Logger('db');
    this.config = getConfig('CRON');
  }

  init() {
    const optionsCamelCase = transformObjectKeys(
      this.config.options,
      camelCase
    );
    const options = objectRenameKey(
      optionsCamelCase,
      'connectTimeoutMs',
      'connectTimeoutMS'
    );

    connect(this.config.db['mongodb.url'], options, (err, client) => {
      if (err) this.logger.debug('Failed to connect', err);
      this.client = client;
    });
  }

  async finish() {
    try {
      await this.client.close();
      this.client = null;
    } catch (error) {
      this.logger.debug(
        'Error while finishing MongoDB connection, going on like nothing happened'
      );
    }
    this.serviceStateManager.signalNotReady('db');
  }

  async healthChecker(signalReady, signalNotReady) {
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
  }

  async shutdownHandler() {
    this.logger.warn('Shutting down MongoDB connection...');
    await this.client.close();
  }

  status() {
    return new Promise((resolve, reject) => {
      let dbStatus = {
        connected: false,
      };
      let isConnected = this.client.isConnected();
      if (isConnected) {
        dbStatus.connected = true;

        let dbStatsPromises = [];
        for (let entry of this.databases.values()) {
          dbStatsPromises.push(entry.db.stats());
        }
        Promise.all(dbStatsPromises)
          .then((allDbStats) => {
            dbStatus.details = allDbStats;
            resolve(dbStatus);
          })
          .catch((error) => {
            this.logger.debug(`Failed to get database status (${error})`);
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
    let key = tenant;
    let db = this.client.db('cron_' + tenant);
    let collection = db.collection('jobs');
    this.logger.info(
      `Created collection jobs into database ${'cron_' + tenant}.`
    );
    let entry = {
      db: db,
      collection: collection,
    };
    this.databases.set(key, entry);
    this.logger.debug(`Cached database clients for tenant ${tenant}.`);
  }

  deleteDatabase(tenant) {
    let key = tenant;
    let entry = this.databases.get(key);
    if (entry) {
      entry.db.dropDatabase();
      this.logger.info(`Droped database ${'cron_' + tenant}.`);
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
    return this.databases.get(tenant).collection.findOne({ jobId: jobId });
  }

  update(tenant, job) {
    // promise
    return this.databases
      .get(tenant)
      .collection.replaceOne({ jobId: job.jobId }, job);
  }

  delete(tenant, jobId) {
    // promise
    return this.databases.get(tenant).collection.deleteOne({ jobId: jobId });
  }
}

module.exports = {
  DatabaseNotFound: DatabaseNotFound,
  InternatlError: InternalError,
  DB: DB,
};
