"use strict";

const axios = require('axios');
const config = require('./config');

class HttpHandler {

    constructor() {

    }

    init() {

    }

    send(tenant, req) {
        console.log(req);
        return new Promise((resolve, reject) => {
            axios({
                method: req.method,
                headers: req.headers,
                url: req.url,
                data: JSON.stringify(req.body),
                timeout: config.cronManager.http.timeout
            }).then(response => {
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
                            console.warn(`Failed to execute http request by criterion 2`);
                            reject();
                        }
                        break;
                    }
                    case 3: {
                        let fre = new RegExp(req.fregex);
                        let nok = fre.exec(response.body);
                        if (nok) {
                            console.warn(`Failed to execute http request by criterion 3`);
                            reject();
                        }
                        else {
                            resolve();
                        }
                        break;
                    }
                    default: {
                        reject();
                        break;
                    }
                }
            }).catch(error => {
                console.warn(`Failed to execute http request (${error})`);
                reject();
            });
        });

    }

}

module.exports = {
    HttpHandler: HttpHandler
};