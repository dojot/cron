"use strict";

const cron = require('./cron');
const api = require('./api');
const config = require('./config')
const healthcheck = require('./healthcheck');
const logger = require("@dojot/dojot-module-logger").logger;

logger.setLevel(config.logger.level);

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection at: ${reason.stack || reason}. Bailing out!!`);
    process.kill(process.pid, "SIGTERM");
});

var cronManager = new cron.CronManager();
cronManager.init().then(() => {
    healthcheck.init(cronManager);
    api.init(cronManager, healthcheck.get());
}).catch(error => {
    logger.error(`Cron service initialization failed (${error}). Bailing out!!`);
    process.kill(process.pid, "SIGTERM");
});
