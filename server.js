"use strict";

const cron = require('./cron');
const api = require('./api');

var cronManager = new cron.CronManager();
cronManager.init().then(() => {
    api.init(cronManager);
}).catch(error => {
    console.error(`Service initialization failed (${error}). Bailing out!!`);
    process.exit(1);
});