"use strict";

const postSchema = require('./schemas/postSchema');
const { getErrors } = require('./schemas/errors');
const cron = require("./cron");


function createModule(cronManager, Logger, config) {
    const logger = new Logger('index');     // Error Messages

    const routes = [
        {
            name: 'create-new-cronJob',
            mountPoint: '/cron/v1',
            path: '/jobs',
            handlers: [
              {
                method: 'post',
                middleware: [
                    (req, res) => {
                        const { error } = postSchema.validate(req.body, { abortEarly: false });
                        const errors = getErrors(error);
                        if (errors) return res.status(400).json({ status: 'error', errors: errors });
                
                        let jobSpec = {
                        time: req.body.time,
                        timezone: req.body.timezone || 'UTC',
                        name: req.body.name,
                        description: req.body.description,
                        http: req.body.http,
                        broker: req.body.broker,
                        jscode: req.body.jscode,
                        };
                
                        cronManager
                            .createJob(req.tenant /*tenant*/, jobSpec)
                                .then((jobId) => {
                                    return res.status(201).json({ status: 'success', jobId: jobId });
                                })
                                    .catch((error) => {
                                        logger.debug(`Something unexpected happened (${error})`, error);
                                        return res
                                            .status(500)
                                                .json({ status: 'error', errors: [errors.internal] });
                                    });
                    }
                ],
              },
            ],
        },
        {
            name: 'edit-cronJob',
            mountPoint: '/cron/v1',
            path: '/jobs/:id',
            handlers: [
                {
                    method: 'put',
                    middleware: [
                        async (req, res) => {
                            const { error } = postSchema.validate(req.body, { abortEarly: false });
                            const errors = getErrors(error);
                            if (errors) return res.status(400).json({ status: 'error', errors: errors });
                    
                            let jobId = req.params.id || null;
                    
                            let jobSpec = {
                            time: req.body.time,
                            timezone: req.body.timezone || 'UTC',
                            name: req.body.name,
                            description: req.body.description,
                            http: req.body.http,
                            broker: req.body.broker,
                            jscode: req.body.jscode,
                            };
                    
                            // To keep the things simpler as possible, the
                            // update operation is implemented by a remove
                            // operation followed by a create operation.
                    
                            // step 1: Remove-if job exists
                            let existingJob = null;
                            try {
                                existingJob = await cronManager.deleteJob(req.tenant /*tenant*/, jobId);
                            } catch (error) {
                                if (!(error instanceof cron.JobNotFound)) {
                                    logger.debug(`Something unexpected happened (${error})`);
                                    return res
                                        .status(500)
                                            .json({ status: 'error', errors: [errors.internal] });
                                }
                            }
                    
                            let successReturnValue;
                            if (existingJob) {
                                logger.debug(
                                        `Replacing job ${JSON.stringify(existingJob)} by ${JSON.stringify({
                                        jobId: jobId,
                                        spec: jobSpec,
                                    })}`
                                );
                                successReturnValue = 200;
                            } else {
                                logger.debug(
                                    `Creating job ${JSON.stringify({ jobId: jobId, spec: jobSpec })}`
                                );
                                successReturnValue = 201;
                            }
                    
                            // step 2: Create job with the given identifier
                            cronManager
                                .createJob(req.tenant /*tenant*/, jobSpec, jobId)
                                    .then((jobId) => {
                                        return res
                                        .status(successReturnValue)
                                        .json({ status: 'success', jobId: jobId });
                                    })
                                        .catch((error) => {
                                            logger.debug(`Something unexpected happened (${error})`);
                                            return res
                                                .status(500)
                                                    .json({ status: 'error', errors: [errors.internal] });
                            });
                        }
                    ],
                },
            ],
        },
        {
            name: 'select-cronJob',
            mountPoint: '/cron/v1',
            path: '/jobs/:id?',
            handlers: [
                {
                    method: 'get',
                    middleware: [
                        (req, res) => {
                            let jobId = req.params.id || null;
                    
                            // get(jobId)
                            if (jobId) {
                                cronManager
                                    .readJob(req.tenant /*tenant*/, jobId)
                                        .then((job) => {
                                            return res.status(200).json(job);
                                        })
                                            .catch((error) => {
                                                if (error instanceof cron.JobNotFound) {
                                                    logger.debug(`Job ${jobId} not found.`);
                                                    return res
                                                    .status(404)
                                                    .json({ status: 'error', errors: [errors.notfound] });
                                                } else {
                                                    logger.debug(`Something unexpected happened (${error})`);
                                                    return res
                                                    .status(500)
                                                    .json({ status: 'error', errors: [errors.internal] });
                                                }
                                            });
                            }
                            // get(all)
                            else {
                                cronManager
                                    .readAllJobs(req.tenant /*tenant*/)
                                        .then((jobs) => {
                                        return res.status(200).json(jobs);
                                        })
                                            .catch((error) => {
                                                logger.debug(`Something unexpected happened (${error})`);
                                                return res
                                                    .status(500)
                                                        .json({ status: 'error', errors: [errors.internal] });
                                            });
                            }
                        }
                    ],
                },
            ],
        },
        {
            name: 'delete-cronJob',
            mountPoint: '/cron/v1',
            path: '/jobs/:id?',
            handlers: [
                {
                    method: 'delete',
                    middleware: [
                        (req, res) => {
                            let jobId = req.params.id || null;
                    
                            // delete one
                            if (jobId) {
                                cronManager
                                    .deleteJob(req.tenant /*tenant*/, jobId)
                                        .then(() => {
                                            return res.status(204).send();
                                        })
                                            .catch((error) => {
                                                if (error instanceof cron.JobNotFound) {
                                                    logger.debug(`Job ${jobId} not found.`);
                                                    return res
                                                        .status(404)
                                                            .json({ status: 'error', errors: [errors.notfound] });
                                                } else {
                                                    logger.debug(`Something unexpected happened (${error})`);
                                                    return res
                                                        .status(500)
                                                            .json({ status: 'error', errors: [errors.internal] });
                                                }
                                            });
                            }
                            // delete all
                            else {
                                cronManager
                                    .deleteAllJobs(req.tenant /*tenant*/)
                                        .then(() => {
                                            return res.status(204).send();
                                        })
                                            .catch((error) => {
                                                logger.debug(`Something unexpected happened (${error})`);
                                                return res
                                                    .status(500)
                                                        .json({ status: 'error', errors: [errors.internal] });
                                            });
                            }
                        }
                    ],
                },
            ],
        },
    ]
   
   return { routes };
}

module.exports = (cronManager, Logger, config) => createModule(cronManager, Logger, config);
