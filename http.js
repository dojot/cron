"use strict";

const axios = require('axios');
const logger = require("@dojot/dojot-module-logger").logger;
const config = require('./config');

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

    constructor() {}

    init() {}

    send(tenant, req) {
        logger.debug(`HTTP request - ${JSON.stringify(req)}.`);
        return new Promise((resolve, reject) => {
            axios({
                method: req.method,
                headers: req.headers,
                url: req.url,
                data: JSON.stringify(req.body),
                timeout: config.cronManager.actions.http.timeout
            }).then(response => {
                logger.debug(`HTTP response - status (${response.status}) data(${JSON.stringify(response.data)}).`)
                //response.status === 2xx
                let criterion = req.criterion || 1;
                switch(criterion) {
                    case 1: {
                        resolve();
                        break;
                    }
                    case 2: {
                        let sre = new RegExp(req.sregex);
                        let ok = sre.exec(response.body);
                        if (ok) {
                            resolve();
                        }
                        else {
                            logger.debug(`Failed to execute http request by criterion 2.`);
                            reject(new JobExecutionFailed(`HTTP request failed by criterion 2.`));
                        }
                        break;
                    }
                    case 3: {
                        let fre = new RegExp(req.fregex);
                        let nok = fre.exec(response.body);
                        if (nok) {
                            logger.debug(`Failed to execute http request by criterion 3.`);
                            reject(new JobExecutionFailed(`HTTP request failed by criterion 3.`));
                        }
                        else {
                            resolve();
                        }
                        break;
                    }
                    default: {
                        logger.debug(`Unknown evaluation criterion ${criterion} for http response.`)
                        reject(new InternalError(`Internal error while evaluating http response.`));
                        break;
                    }
                }
            }).catch(error => {
                logger.debug(`Failed to execute http request (${error}).`);
                reject(new InternalError(`Internal error while execution http request.`));
            });
        });

    }

}

module.exports = {
    HttpHandler: HttpHandler,
    JobExecutionFailed: JobExecutionFailed,
    InternalError: InternalError
};