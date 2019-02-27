"use strict";

const cron = require('./cron');
const api = require('./api');
const logger = require("@dojot/dojot-module-logger").logger;

logger.setLevel("info");

var cronManager = new cron.CronManager();
cronManager.init().then(() => {
    api.init(cronManager);
}).catch(error => {
    logger.error(`Cron service initialization failed (${error}). Bailing out!!`);
    process.exit(1);
});