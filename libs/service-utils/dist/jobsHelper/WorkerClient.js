"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerClient = void 0;
const types_1 = require("./types");
/**
 * Get worker configuration from passed `config`.
 *
 * Throw an exception if the worker config is missing or invalid.
 */
function getWorkerConfig(config) {
    if (!config.worker?.redis?.host || !config.worker?.redis?.port || !config.worker?.queues) {
        throw new Error('Missing or invalid worker config');
    }
    return {
        queues: config.worker.queues,
        connection: {
            host: config.worker.redis.host,
            port: +config.worker.redis.port,
            ...(config.worker.redis.password && { password: config.worker.redis.password })
        }
    };
}
async function waitUntilFinished(job, queueEvents, creationDate, maxSecondsInQueue) {
    if (!maxSecondsInQueue) {
        return await job.waitUntilFinished(queueEvents, undefined);
    }
    const ttl = maxSecondsInQueue * 1000 - (new Date().valueOf() - creationDate.valueOf());
    try {
        // We're using `Promise.race` here instead of `ttl` argument of `waitUntilFinished`,
        // because we need to distinguish between job not completing in ttl and job failing,
        // and errors thrown by `waitUntilFinished` only differ by error messages in these two cases
        return await Promise.race([
            job.waitUntilFinished(queueEvents, undefined),
            new Promise((_resolve, reject) => setTimeout(() => reject(new types_1.JobCompletionError('timeout')), ttl))
        ]);
    }
    catch (err) {
        job.discard();
        if (err instanceof types_1.JobCompletionError) {
            throw err;
        }
        else {
            throw new types_1.JobCompletionError('failed');
        }
    }
}
// TODO: move this to export-pdf plugin once render-network is removed
function joinUrlParts(...fragments) {
    return fragments
        .map(x => x && x.replace(/^\/+|\/+$/g, ''))
        .filter(x => !!x)
        .join('/');
}
// TODO: move this to export-pdf plugin once render-network is removed
function getS3DatawrapperUploadOptions(s3) {
    if (!s3) {
        return [];
    }
    return [
        {
            type: 's3-datawrapper',
            dirPath: s3.dirPath,
            uploadConfig: {
                ACL: s3.acl,
                Bucket: s3.bucket
            }
        }
    ];
}
// TODO: move this to export-pdf plugin once render-network is removed
async function getPublishUploadOptions(db, publishOptions) {
    if (!publishOptions?.teamId) {
        return [];
    }
    const team = await db.models.team.findByPk(publishOptions.teamId);
    const publishTarget = team?.settings?.publishTarget;
    if (!publishTarget?.provider) {
        return [];
    }
    switch (publishTarget.provider) {
        case 'gcs': {
            const config = publishTarget.config;
            return [
                {
                    type: 'gcs-custom',
                    bucket: config.bucket,
                    gcsConfig: {
                        credentials: {
                            client_email: config.client_email,
                            private_key: config.private_key
                        },
                        projectId: config.project_id
                    },
                    dirPath: joinUrlParts(publishTarget.url_prefix, publishOptions.outDir)
                }
            ];
        }
        case 's3': {
            const config = publishTarget.config;
            return [
                {
                    type: 's3-custom',
                    s3Config: {
                        accessKeyId: config.accesskey,
                        endpoint: config.endpoint,
                        region: config.region,
                        secretAccessKey: config.secretkey
                    },
                    uploadConfig: {
                        ACL: config.acl || 'public-read',
                        Bucket: config.bucket,
                        CacheControl: config.cacheControl
                    },
                    dirPath: joinUrlParts(publishTarget.url_prefix, publishOptions.outDir)
                }
            ];
        }
        default:
            // From type checking standpoint, `publishTarget` is `never` in this branch
            // (because we exhausted all other possibilities)
            // so we need to cast it to any to be able to print an informative error message
            // in case `publishTarget.provider` holds any incorrect string.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unknown publish provider ${publishTarget.provider}!`);
    }
}
class WorkerClient {
    Queue;
    QueueEvents;
    workerConfig;
    db;
    constructor(serverConfig, Queue, QueueEvents, db) {
        this.Queue = Queue;
        this.QueueEvents = QueueEvents;
        this.workerConfig = getWorkerConfig(serverConfig);
        this.db = db;
    }
    get queues() {
        return this.workerConfig.queues;
    }
    async scheduleJob(queueName, jobType, jobPayload) {
        const { queues, connection } = this.workerConfig;
        if (!queues[queueName]) {
            throw new Error('unsupported queue name');
        }
        const queue = new this.Queue(queueName, { connection });
        const job = (await queue.add(jobType, jobPayload));
        const creationDate = new Date();
        return {
            getResult: maxSecondsInQueue => {
                const queueEvents = new this.QueueEvents(queueName, { connection });
                return waitUntilFinished(job, queueEvents, creationDate, maxSecondsInQueue);
            }
        };
    }
    async scheduleJobs(queueName, jobType, jobPayloads) {
        const { queues, connection } = this.workerConfig;
        if (!queues[queueName]) {
            throw new Error('unsupported queue name');
        }
        const queue = new this.Queue(queueName, { connection });
        const jobs = (await queue.addBulk(jobPayloads.map(data => ({ name: jobType, data }))));
        const creationDate = new Date();
        return {
            getResults: maxSecondsInQueue => {
                const queueEvents = new this.QueueEvents(queueName, { connection });
                return jobs.map(job => waitUntilFinished(job, queueEvents, creationDate, maxSecondsInQueue));
            }
        };
    }
    async scheduleJobAndWaitForResults(queueName, jobType, jobPayload) {
        const job = await this.scheduleJob(queueName, jobType, jobPayload);
        return await job.getResult();
    }
    async scheduleChartExport(queueName, { chart, userId, ...jobData }) {
        const accessTokenObject = await this.db.models.access_token.createChartExportToken(chart, userId);
        // TODO: move jobPayload creation to export-pdf plugin once render-network is removed
        const jobInfo = await this.scheduleJob(queueName, 'exportChart', {
            accessToken: accessTokenObject.token,
            chartId: chart.id,
            exports: jobData.exports,
            upload: [
                ...getS3DatawrapperUploadOptions(jobData.upload?.s3),
                ...(await getPublishUploadOptions(this.db, jobData.publish))
            ]
        });
        return {
            // TODO: move this to export-pdf plugin once render-network is removed
            getResult: async (maxSecondsInQueue) => {
                try {
                    return await jobInfo.getResult(maxSecondsInQueue);
                }
                finally {
                    accessTokenObject.destroy({ force: true });
                }
            }
        };
    }
    async getQueueHealth(queueName, jobsSampleSize) {
        const { queues, connection } = this.workerConfig;
        if (!queues[queueName]) {
            throw new Error('unsupported queue name');
        }
        const report = { connected: false };
        const queue = new this.Queue(queueName, { connection });
        // Check if the queue is paused and implicitly also if we can connect to the queue.
        try {
            report.paused = await queue.isPaused();
            report.connected = true;
        }
        catch (error) {
            return report;
        }
        // Check the number of workers connected to the queue.
        const workers = await queue.getWorkers();
        report.numWorkers = workers.length;
        if (!report.numWorkers) {
            return report;
        }
        // Check if the queue is idle, i.e. if there are no jobs waiting to be processed.
        report.idle = (await queue.getJobCountByTypes('active', 'waiting')) === 0;
        // Check the number of finished jobs in the queue.
        const finishedJobs = await queue.getJobs(['completed', 'failed'], 0, jobsSampleSize);
        report.jobs = report.jobs || {};
        report.jobs.numFinished = finishedJobs.length;
        const lastFinishedJob = finishedJobs[0];
        if (!lastFinishedJob) {
            return report;
        }
        // Check when was the last time a job finished.
        report.lastJobFinishedAgoMs = new Date().getTime() - lastFinishedJob.finishedOn;
        // Check how many of the finished jobs have completed.
        report.jobs.numCompleted = (await Promise.all(finishedJobs.map(job => job.isCompleted()))).filter(Boolean).length;
        // Check the ratio between the finished and completed jobs.
        report.jobs.ratioCompleted = report.jobs.numFinished / report.jobs.numCompleted;
        return report;
    }
}
exports.WorkerClient = WorkerClient;
