"use strict";

const axios = require("axios");
const { ConfigManager: { getConfig }, Logger } = require("@dojot/microservice-sdk");

// Errors ...
class JobExecutionFailed extends Error {
  constructor(...args) {
    super(...args);
  }
}

class InternalError extends Error {
  constructor(...args) {
    super(...args);
  }
}
// ... Errors

class HttpHandler {
  constructor() {
    this.logger = new Logger('http');

    this.config = getConfig('CRON');
  }

  init() {}

  send(tenant, req) {
    this.logger.debug(`HTTP request - ${JSON.stringify(req)}.`);
    return new Promise((resolve, reject) => {
      axios({
        method: req.method,
        headers: req.headers,
        url: req.url,
        data: JSON.stringify(req.body),
        timeout: this.config.actions['http.timeout'],
      })
        .then((response) => {
          this.logger.debug(
            `HTTP response - status (${response.status}) data(${JSON.stringify(
              response.data
            )}).`
          );
          //response.status === 2xx
          let criterion = req.criterion || 1;
          switch (criterion) {
            case 1: {
              resolve();
              break;
            }
            case 2: {
              let sre = new RegExp(req.sregex);
              let ok = sre.exec(response.body);
              if (ok) {
                resolve();
              } else {
                this.logger.debug(
                  `Failed to execute http request by criterion 2.`
                );
                reject(
                  new JobExecutionFailed(`HTTP request failed by criterion 2.`)
                );
              }
              break;
            }
            case 3: {
              let fre = new RegExp(req.fregex);
              let nok = fre.exec(response.body);
              if (nok) {
                this.logger.debug(
                  `Failed to execute http request by criterion 3.`
                );
                reject(
                  new JobExecutionFailed(`HTTP request failed by criterion 3.`)
                );
              } else {
                resolve();
              }
              break;
            }
            default: {
              this.logger.debug(
                `Unknown evaluation criterion ${criterion} for http response.`
              );
              reject(
                new InternalError(
                  `Internal error while evaluating http response.`
                )
              );
              break;
            }
          }
        })
        .catch((error) => {
          this.logger.debug(`Failed to execute http request (${error}).`);
          reject(
            new InternalError(`Internal error while execution http request.`)
          );
        });
    });
  }
}

module.exports = {
  HttpHandler: HttpHandler,
  JobExecutionFailed: JobExecutionFailed,
  InternalError: InternalError,
};
