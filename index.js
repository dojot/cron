const {
  ConfigManager: { getConfig, loadSettings },
  Logger,
  WebUtils: { SecretFileHandler },
} = require('@dojot/microservice-sdk');

const createApp = require('./src/app/main');
const { killApplication } = require('./src/Utils');

// Configurations
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

const secretFileHandler = new SecretFileHandler(config, logger);
secretFileHandler
  .handle('keycloak.client.secret', '/secrets/')
  .then(() => {
    createApp(config, logger).catch((error) => {
      logger.error(error.message);
      killApplication();
    });
  })
  .catch((error) => {
    logger.error(error.message);
    killApplication();
  });
