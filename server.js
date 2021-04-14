"use strict";

const cron = require("./cron");
const api = require("./api");
const config = require("./config");
const healthcheck = require("./healthcheck");
const { Logger } = require("@dojot/microservice-sdk");

// Logger configuration
Logger.setVerbose(config.logger.verbose);
Logger.setTransport('console', { level: config.logger['console.level'] });
if (config.logger.file.enable) {
  Logger.setTransport('file', {
    level: config.logger.file.level,
    filename: config.logger.file.filename,
  });
}
const logger = new Logger('server');

process.on('unhandledRejection', (reason) => {
  logger.error(
    `Unhandled Rejection at: ${reason.stack || reason}. Bailing out!!`
  );
  process.kill(process.pid, 'SIGTERM');
});

let cronManager = new cron.CronManager();

cronManager
  .init()
  .then(() => {
    healthcheck.init(cronManager);
    api.init(cronManager, healthcheck.get());
  })
  .catch((error) => {
    logger.error(
      `Cron service initialization failed (${error}). Bailing out!!`
    );
    process.kill(process.pid, 'SIGTERM');
  });
