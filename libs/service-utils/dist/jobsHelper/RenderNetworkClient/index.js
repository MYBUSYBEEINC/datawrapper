"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderNetworkClient = void 0;
const lodash_1 = require("lodash");
const types_1 = require("../types");
const tasks_1 = require("./tasks");
const waitForJobCompletion = (job, maxSecondsInQueue) => {
    // todo keep request open until result
    const deadline = Date.now() + (maxSecondsInQueue ?? 0) * 1000;
    return new Promise((resolve, reject) => {
        (function checkResult() {
            job.reload().then(job => {
                if (job.status === 'done') {
                    return resolve();
                }
                if (job.status === 'failed') {
                    return reject(new types_1.JobCompletionError('failed'));
                }
                if (job.status === 'queued' && maxSecondsInQueue && Date.now() > deadline) {
                    job.status = 'done';
                    job.done_at = new Date();
                    job.save();
                    return reject(new types_1.JobCompletionError('timeout'));
                }
                if (job.status === 'in_progress' && maxSecondsInQueue && job.priority >= 0) {
                    // Negative priority will prevent this job from being ever scheduled again.
                    // Limit on the time spent in queue implies that we don't want to retry the job,
                    // because jobs are only retried after spending too much time in execution.
                    job.priority = -1;
                    job.save();
                }
                setTimeout(checkResult, 1000);
            });
        })();
    });
};
class RenderNetworkClient {
    db;
    constructor(db) {
        this.db = db;
    }
    async bulkCreate(bulkJobData, options) {
        const jobs = await this.db.models.export_job.bulkCreate(bulkJobData.map(({ chartId, userId, tasks }) => ({
            key: options.key,
            priority: options.priority,
            chart_id: chartId,
            user_id: userId,
            tasks
        })));
        return {
            getResults: maxSecondsInQueue => jobs.map(job => waitForJobCompletion(job, maxSecondsInQueue))
        };
    }
    async create({ chartId, userId, tasks }, options) {
        const job = await this.db.models.export_job.create({
            key: options.key,
            priority: options.priority,
            chart_id: chartId,
            user_id: userId,
            tasks: tasks
        });
        return {
            getResult: maxSecondsInQueue => waitForJobCompletion(job, maxSecondsInQueue)
        };
    }
    async scheduleInvalidateCloudflareJobs(bulkJobData, options) {
        return await this.bulkCreate(bulkJobData.map(({ chartId, userId, urls }) => ({
            chartId,
            userId,
            tasks: [
                {
                    action: 'cloudflare',
                    params: {
                        urls
                    }
                }
            ]
        })), options);
    }
    async scheduleInvalidateCloudflareJob({ chartId, userId, urls }, options) {
        return await this.create({
            chartId,
            userId,
            tasks: [(0, tasks_1.createCloudflareInvalidateTask)(urls)]
        }, options);
    }
    async scheduleChartExport(jobData, options) {
        const exportFilenames = jobData.exports.map(({ filename }) => filename);
        const publishOptions = jobData.publish;
        const s3Options = jobData.save?.s3;
        const exportsByType = (0, lodash_1.groupBy)(jobData.exports, data => data.format);
        return await this.create({
            chartId: jobData.chartId,
            userId: jobData.userId,
            tasks: [
                ...Object.keys(exportsByType).flatMap(format => {
                    switch (format) {
                        case types_1.ExportFormat.PDF:
                            return (0, tasks_1.createPdfTasks)(exportsByType[format]);
                        case types_1.ExportFormat.SVG:
                            return (0, tasks_1.createSvgTasks)(exportsByType[format]);
                        case types_1.ExportFormat.PNG:
                            return (0, tasks_1.createPngTasks)(exportsByType[format]);
                        default:
                            throw new Error(`Unsupported format ${format}`);
                    }
                }),
                ...(publishOptions
                    ? (0, tasks_1.createExportFilePublishTasks)(publishOptions, exportFilenames)
                    : []),
                ...(s3Options ? (0, tasks_1.createExportFileS3Tasks)(s3Options, exportFilenames) : [])
            ]
        }, options);
    }
}
exports.RenderNetworkClient = RenderNetworkClient;
