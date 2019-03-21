"use strict";

const mongo = require('mongodb').MongoClient;
const logger = require("@dojot/dojot-module-logger").logger;
const config = require('./config');

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
    }

    init() {
        return mongo.connect(config.cronManager.db.mongodb.url,
            config.cronManager.db.mongodb.options).then((client) => {
            this.client = client;
          });
    }

    status() {
        return new Promise((resolve, reject) => {
            let dbStatus = {
                connected: false
            };
            let isConnected = this.client.isConnected();
            if (isConnected) {
                dbStatus.connected = true;

                let dbStatsPromises = [];
                for (let entry of this.databases.values()) {
                    dbStatsPromises.push(entry.db.stats());
                }
                Promise.all(dbStatsPromises).then(allDbStats => {
                    dbStatus.details = allDbStats;
                    resolve(dbStatus);
                }).catch(error => {
                    logger.debug(`Failed to get database status (${error})`);
                    reject(new InternalError(`Internal error while getting database status.`));
                });
            }
            else {
                resolve(dbStatus);
            }
        });
    }

    createDatabase(tenant) {
        let key = tenant;
        let db = this.client.db('cron_' + tenant);
        let collection = db.collection('jobs');
        logger.info(`Created collection jobs into database ${'cron_' + tenant}.`);
        let entry = {
            db: db,
            collection: collection
        };
        this.databases.set(key, entry);
        logger.debug(`Cached database clients for tenant ${tenant}.`);
    }

    deleteDatabase(tenant) {
        let key = tenant;
        let entry = this.databases.get(key);
        if(entry) {
            entry.db.dropDatabase();
            logger.info(`Droped database ${'cron_' + tenant}.`)
            this.databases.delete(key);
        }
        else {
            logger.debug(`Nothing to be unset. Database doesn't exist for tenant ${tenant}.`);
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
        return this.databases.get(tenant).collection.findOne({jobId: jobId});
    }

    update(tenant, job) {
        // promise
        return this.databases.get(tenant).collection.replaceOne({jobId: job.jobId}, job);
    }

    delete(tenant, jobId) {
        // promise
        return this.databases.get(tenant).collection.deleteOne({jobId: jobId});
    }
}

module.exports = {
    DatabaseNotFound: DatabaseNotFound,
    InternatlError: InternalError,
    DB: DB
};