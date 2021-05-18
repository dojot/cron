const {
  ConfigManager: { getConfig, loadSettings, transformObjectKeys },
  Logger,
  WebUtils,
  ServiceStateManager,
} = require('@dojot/microservice-sdk');
const camelCase = require('lodash.camelcase');
const { killApplication } = require('./app/Utils');
const { CronManager } = require('./app/cron');

const userConfigFile =
  process.env.CRON_APP_USER_CONFIG_FILE || 'production.conf';
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
  killApplication();
});

// Registering the services, shutdown handlers and health checkers
serviceStateManager.registerService('kafka-consumer');
serviceStateManager.registerService('kafka-producer');
serviceStateManager.registerService('db-cron');
serviceStateManager.registerService('server');

const cronManager = new CronManager(serviceStateManager);

const routes = require('./app/api')(cronManager, Logger);

// create an instance of HTTP server
const server = WebUtils.createServer({ logger });

const {
  tokenParsingInterceptor,
  beaconInterceptor,
  readinessInterceptor,
  jsonBodyParsingInterceptor,
  requestLogInterceptor,
} = WebUtils.framework.interceptors;

// creates an instance of Express.js already configured
const framework = WebUtils.framework.createExpress({
  logger,
  server,
  routes: routes.flat(),
  interceptors: [
    tokenParsingInterceptor(),
    beaconInterceptor({
      stateManager: serviceStateManager,
      logger,
    }),
    readinessInterceptor({
      stateManager: serviceStateManager,
      logger,
    }),
    requestLogInterceptor({
      logger,
    }),
    jsonBodyParsingInterceptor({ config: 1000 }),
  ],
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
    serviceStateManager.signalReady('server');
  })
  .catch((error) => {
    logger.error(
      `Cron service initialization failed (${error}). Bailing out!!`
    );
    serviceStateManager.signalNotReady('server');
    killApplication();
  });
