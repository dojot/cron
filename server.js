"use strict";

const cron = require("./cron");
const broker = require("./broker");
const db = require("./db");
const api = require("./api");
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
let dbManager = new db.DB(serviceStateManager);

// Registering the services, shutdown handlers and health checkers
serviceStateManager.registerService('kafka-cron');
serviceStateManager.registerService('kafka-broker');
serviceStateManager.registerService('db');
serviceStateManager.registerShutdownHandler(cronManager.shutdownHandler.bind(cronManager));
serviceStateManager.registerShutdownHandler(brokerManager.shutdownHandler.bind(brokerManager));
serviceStateManager.registerShutdownHandler(dbManager.shutdownHandler.bind(dbManager));
serviceStateManager.addHealthChecker(
  'kafka-cron',
  cronManager.healthChecker.bind(cronManager),
  config.healthChecker['kafka.interval.ms'],
);
serviceStateManager.addHealthChecker(
  'kafka-broker',
  brokerManager.healthChecker.bind(brokerManager),
  config.healthChecker['kafka.interval.ms'],
);
serviceStateManager.addHealthChecker(
  'db',
  dbManager.healthChecker.bind(dbManager),
  config.healthChecker['kafka.interval.ms'],
);

cronManager
  .init()
  .then(() => {
    api.init(cronManager);
  })
  .catch((error) => {
    logger.error(
      `Cron service initialization failed (${error}). Bailing out!!`
    );
    Utils.killApplication();
  });
