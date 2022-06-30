const {
  ConfigManager: { transformObjectKeys },
  Logger,
  WebUtils,
  Kafka: { Consumer: BrokerConsumer },
  ServiceStateManager,
} = require('@dojot/microservice-sdk');
const camelCase = require('lodash.camelcase');
const { killApplication } = require('../Utils');
const TenantManager = require('../service/tenant-manager');
const { CronManager } = require('../service/cron-manager');
const createRoutes = require('./api');
const { HttpHandler } = require('../external/http-handler');
const { BrokerProducer } = require('./broker-producer');

module.exports = async function createApp(config, logger) {
  const serviceStateManager = new ServiceStateManager({
    lightship: transformObjectKeys(config.lightship, camelCase),
  });

  const dojotClientHttp = new WebUtils.DojotClientHttp({
    defaultClientOptions: {},
    logger,
    defaultMaxNumberAttempts: 0,
  });

  const tenantManager = new TenantManager({
    keycloakConfig: config.keycloak,
    dojotClientHttp,
    logger,
  });
  await tenantManager.loadTenants();
  const httpHandler = new HttpHandler(tenantManager);

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

  const brokerConsumer = new BrokerConsumer({
    ...config.sdkConsumer,
    'kafka.consumer': config.consumer,
    'kafka.topic': config.topic,
  });
  const brokerProducer = new BrokerProducer();

  const cronManager = new CronManager(
    serviceStateManager,
    httpHandler,
    tenantManager,
    brokerProducer,
    brokerConsumer
  );

  const routes = createRoutes(cronManager, Logger);

  // create an instance of HTTP server
  const server = WebUtils.createServer({ logger });
  const {
    beaconInterceptor,
    readinessInterceptor,
    jsonBodyParsingInterceptor,
    requestLogInterceptor,
    createKeycloakAuthInterceptor,
  } = WebUtils.framework.interceptors;

  // creates an instance of Express.js already configured
  const framework = WebUtils.framework.createExpress({
    logger,
    server,
    routes: routes.flat(),
    interceptors: [
      createKeycloakAuthInterceptor(tenantManager.tenants, logger),
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
};
