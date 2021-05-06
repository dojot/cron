"use strict";

const cron = require("./cron");
const broker = require("./broker");
const db = require("./db");
const {   
  ConfigManager: { getConfig, loadSettings, transformObjectKeys },
  Logger,
  WebUtils,
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

const { routes } = require('./api')(cronManager, Logger, config);

// create an instance of HTTP server
const server = WebUtils.createServer({ logger });

const { 
    tokenParsingInterceptor,
    beaconInterceptor,
    jsonBodyParsingInterceptor 
} = WebUtils.framework.interceptors;

// creates an instance of Express.js already configured
const framework = WebUtils.framework.createExpress({
    logger,
    server,
    routes,
    interceptors: [
        tokenParsingInterceptor(),
        // beaconInterceptor(),
        jsonBodyParsingInterceptor({config: 1000})
    ]
});

cronManager
  .init()
  .then(() => {
    // emitted each time there is a request
    server.on('request', framework);
    // boots up the server
    server.listen(5000, () => {
        logger.info('[api] Cron service listening on port 5000');
    });
  })
  .catch((error) => {
    logger.error(
      `Cron service initialization failed (${error}). Bailing out!!`
    );
    Utils.killApplication();
  });
