const Joi = require('joi');
const { errors } = require('./errors');
const timeParser = require('cron-parser');
const {
  ConfigManager: { getConfig, loadSettings },
} = require('@dojot/microservice-sdk');

// ConfigManager
const userConfigFile =
  process.env.CRON_APP_USER_CONFIG_FILE || 'production.conf';
loadSettings('CRON', userConfigFile);
const config = getConfig('CRON');

const joiSchema = Joi.object({
  // name validation
  name: Joi.string()
    .min(2)
    .max(128)
    .optional()
    .error(new Error(JSON.stringify(errors.invalid.name))),
  // cron time validation
  time: Joi.string()
    .custom((value, helper) => {
      const isValid = timeParser.parseString(value);

      if (
        typeof isValid.errors != 'undefined' &&
        Object(isValid.errors).length > 0
      ) {
        return helper.message('any.invalid');
      } else {
        return true;
      }
    })
    .error(new Error(JSON.stringify(errors.invalid.time))),
  // timezone validation
  timezone: Joi.string()
    .optional()
    .error(new Error(JSON.stringify(errors.invalid.timezone))),
  // description validation
  description: Joi.string()
    .optional()
    .max(1024)
    .error(new Error(JSON.stringify(errors.invalid.description))),
  http: Joi.object({
    //http-url
    url: Joi.string()
      .custom((value, helper) => {
        // allowed base URLs
        for (let baseURL of config.actions['allowedBaseURLs']) {
          if (value.startsWith(baseURL)) {
            return true;
          }
        }
        return helper.message('any.invalid');
      })
      .error(new Error(JSON.stringify(errors.invalid.http.url))),
    //http-headers
    headers: Joi.any()
      .optional()
      .custom((value, helper) => {
        if (!value) return true;
        // json
        let headers = JSON.stringify(value);
        // max:2048
        if (headers.length <= 2048) {
          return true;
        } else {
          return helper.message('any.invalid');
        }
      })
      .error(new Error(JSON.stringify(errors.invalid.http.headers))),
    //http-criterion
    criterion: Joi.number()
      .optional()
      .min(1)
      .max(3)
      .error(new Error(JSON.stringify(errors.invalid.http.criterion))),

    //http-sregex
    sregex: Joi.string()
      .optional()
      .max(256)
      .error(new Error(JSON.stringify(errors.invalid.http.sregex))),

    //http-fregex
    fregex: Joi.string()
      .optional()
      .max(256)
      .error(new Error(JSON.stringify(errors.invalid.http.fregex))),
    //http-body
    body: Joi.any()
      .optional()
      .custom((value, helper) => {
        if (!value) return helper.message('any.invalid');
        // json
        const body = JSON.stringify(value);
        // max: 8192
        if (body.length <= 8192) {
          return true;
        } else {
          return helper.message('any.invalid');
        }
      })
      .error(new Error(JSON.stringify(errors.invalid.http.body))),
  }).error((errors) => new Error(errors.join(''))),
  broker: Joi.object({
    // broker-subject
    subject: Joi.string()
      .max(128)
      .error(new Error(JSON.stringify(errors.invalid.broker.subject))),
    // broker-message
    message: Joi.any()
      .optional()
      .custom((value, helper) => {
        if (!value) return helper.message('any.invalid');
        // json
        const message = JSON.stringify(value);
        // max:8192
        if (message.length <= 8192) {
          return true;
        } else {
          return helper.message('any.invalid');
        }
      })
      .error(new Error(JSON.stringify(errors.invalid.broker.message))),
  }).error((errors) => new Error(errors.join(''))),
}).error((errors) => new Error(errors.join('')));

module.exports = joiSchema;
