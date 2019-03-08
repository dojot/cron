"use strict";

const os = require('os');
const pjson = require('./package.json');
const config = require('./config');
const HealthChecker = require('@dojot/healthcheck').HealthChecker;
const DataTrigger = require('@dojot/healthcheck').DataTrigger;
const logger = require("@dojot/dojot-module-logger").logger;

// cron Manager
var cronManager = null; // initialized at init()

//health checker
const healthCheckerConfig = {
    description: 'health of cron service',
    version: pjson.version,
    status: 'pass'
};

const healthChecker = new HealthChecker(healthCheckerConfig);

// uptime
const uptime = {
    measurementName: 'uptime',
    componentType: 'system',
    observedUnit: 's',
    status: 'pass'
};

const uptimeCollector = (trigger = DataTrigger) => {
    let value = Math.floor(process.uptime());
    trigger.trigger(value, 'pass');
    logger.debug(`[HEALTH CHECK] SYSTEM UPTIME ${value}`);
    return value;
};

healthChecker.registerMonitor(uptime, uptimeCollector,
    config.healthChecker.timeout.uptime);

// memory:utilization
const memory = {
    componentName: 'memory',
    componentType: 'system',
    measurementName: 'utilization',
    observedUnit: 'percent',
    status: 'pass'
}

const memoryCollector = (trigger = DataTrigger) => {
    let tmem = os.totalmem();
    let fmem = os.freemem();
    let pmem = (100 - (fmem/tmem)*100).toFixed(2);
    if (pmem > 75) {
        trigger.trigger(pmem, 'warn');
    }
    else {
        trigger.trigger(pmem, 'pass');
    }
    logger.debug(`[HEALTH CHECK] MEMORY UTILIZATION ${pmem}`);
    return pmem;
};

healthChecker.registerMonitor(memory, memoryCollector,
    config.healthChecker.timeout.memory);

// cpu:utilization
const cpu = {
    componentName: 'cpu',
    componentType: 'system',
    measurementName: 'utilization',
    observedUnit: 'percent',
    status: 'pass'
}

const cpuCollector = (trigger = DataTrigger) => {
    let ncpu = os.cpus().length;
    let lcpu = os.loadavg()[5]; //last five minute
    let pcpu = (100 * lcpu/ncpu).toFixed(2);
    if (pcpu > 75) {
        trigger.trigger(pcpu, 'warn');
    }
    else {
        trigger.trigger(pcpu, 'pass');
    }
    logger.debug(`[HEALTH CHECK] CPU UTILIZATION ${pcpu}`);
    return pcpu;
};

healthChecker.registerMonitor(cpu, cpuCollector,
    config.healthChecker.timeout.cpu);

// mongodb:connections
const mongodb = {
    componentName: 'mongodb',
    componentType: 'datastore',
    measurementName: 'connections',
    status: 'pass'
};

const mongodbCollector = (trigger = DataTrigger) => {
    return cronManager.db.status().then(status => {
        if (status.connected) {
            logger.debug('[HEALTH CHECK] MONGODB CONNECTION OK');
            trigger.trigger(1 /*one connection */, 'pass');
        }
        else {
            logger.debug('[HEALTH CHECK] MONGODB CONNECTION NOK');
            trigger.trigger(0 /*one connection */, 'fail');
        }
    }).catch(error => {
        logger.debug('[HEALTH CHECK] MONGODB CONNECTION OK');
        trigger.trigger(0 /* zero connections*/, 'fail', error);
    });
};

healthChecker.registerMonitor(mongodb, mongodbCollector,
    config.healthChecker.timeout.mongodb);

// kafka:connections
const kafka = {
    componentName: 'kafka',
    componentType: 'datastore',
    measurementName: 'connections',
    status: 'pass'
};

const kafkaCollector = (trigger = DataTrigger) => {
    return cronManager.brokerHandler.status().then(status => {
        trigger.trigger(1 /*one connection */, 'pass');
        logger.debug('[HEALTH CHECK] KAFKA CONNECTION OK');
    }).catch(error => {
        trigger.trigger(0 /* zero connections*/, 'fail', error);
        logger.debug('[HEALTH CHECK] KAFKA CONNECTION NOK');
    });
};

healthChecker.registerMonitor(kafka, kafkaCollector,
    config.healthChecker.timeout.kafka);

module.exports = {
    init: (mgr) => {
        cronManager = mgr;
    },
    get: () => {
        return healthChecker;
    }
  };