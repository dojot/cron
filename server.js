"use strict";

const cron = require("./cron");
const broker = require("./broker");
const api = require("./api");
// const healthcheck = require("./healthcheck");
const {   
  ConfigManager: { getConfig, loadSettings, transformObjectKeys },
  Logger,
  ServiceStateManager
} = require("@dojot/microservice-sdk");
const camelCase = require('lodash.camelcase');
const Utils = require("./Utils");


const userConfigFile = process.env.K2V_APP_USER_CONFIG_FILE || 'production.conf';
loadSettings('CRON', userConfigFile);
const config = getConfig('CRON');

// Logger configuration
Logger.setVerbose(config.logger.verbose);
Logger.setTransport('console', { level: config.logger['console.level'] });
if (config.logger['file.enable']) {
  Logger.setTransport('file', {
    level: config.logger['file.level'],
    filename: config.logger['file.filename'],
  });
}
const logger = new Logger('server');

const serviceStateManager = new ServiceStateManager({
  lightship: transformObjectKeys(config.lightship, camelCase),
});

process.on('unhandledRejection', (reason) => {
  logger.error(
    `Unhandled Rejection at: ${reason.stack || reason}. Bailing out!!`
  );
  Utils.killApplication();
});

let cronManager = new cron.CronManager(serviceStateManager);
let brokerManager = new broker.BrokerHandler(serviceStateManager);

// Registering the services, shutdown handlers and health checkers
serviceStateManager.registerService('kafka');
// serviceStateManager.registerService('broker');
serviceStateManager.registerShutdownHandler(cronManager.shutdownHandler.bind(cronManager));
serviceStateManager.registerShutdownHandler(brokerManager.shutdownHandler.bind(brokerManager));
serviceStateManager.addHealthChecker(
  'kafka',
  cronManager.healthChecker.bind(cronManager),
  config.healthChecker['kafka.interval.ms'],
);
// serviceStateManager.addHealthChecker(
//   'kafka',
//   brokerManager.healthChecker.bind(brokerManager),
//   config.healthChecker['kafka.interval.ms'],
// );

cronManager
  .init()
  .then(() => {
    // healthcheck.init(cronManager);
    api.init(cronManager/*, healthcheck.get()*/);
  })
  .catch((error) => {
    logger.error(
      `Cron service initialization failed (${error}). Bailing out!!`
    );
    Utils.killApplication();
  });
