"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderNetworkClient = void 0;
const node_path_1 = __importDefault(require("node:path"));
const types_1 = require("./types");
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
    ExportJob;
    constructor(ExportJob) {
        this.ExportJob = ExportJob;
    }
    async bulkCreate(bulkJobData, options) {
        const jobs = await this.ExportJob.bulkCreate(bulkJobData.map(({ chartId, userId, tasks }) => ({
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
        const job = await this.ExportJob.create({
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
            tasks: [
                {
                    action: 'cloudflare',
                    params: {
                        urls
                    }
                }
            ]
        }, options);
    }
    async scheduleChartExport(jobData, options) {
        const tasks = [];
        switch (jobData.export.format) {
            case types_1.ExportFormat.PDF:
                {
                    const { colorMode, ...pdfOptions } = jobData.export.options;
                    tasks.push({
                        action: jobData.export.format,
                        params: {
                            ...pdfOptions,
                            mode: colorMode,
                            out: jobData.export.filename
                        }
                    });
                }
                break;
            case types_1.ExportFormat.SVG:
                tasks.push({
                    action: jobData.export.format,
                    params: {
                        ...jobData.export.options,
                        out: jobData.export.filename
                    }
                });
                break;
            case types_1.ExportFormat.PNG:
                tasks.push({
                    action: jobData.export.format,
                    params: {
                        sizes: [
                            {
                                ...jobData.export.options,
                                out: jobData.export.filename
                            }
                        ]
                    }
                });
                if (jobData.export.border) {
                    tasks.push({
                        action: 'border',
                        params: {
                            ...jobData.export.border,
                            image: jobData.export.filename,
                            out: jobData.export.filename
                        }
                    });
                }
                if (jobData.export.exif) {
                    tasks.push({
                        action: 'exif',
                        params: {
                            ...jobData.export.exif,
                            image: jobData.export.filename
                        }
                    });
                }
                break;
            default:
                throw new Error('Unsupported format');
        }
        if (jobData.publish) {
            tasks.push({
                action: 'publish',
                params: {
                    file: jobData.export.filename,
                    teamId: jobData.publish.teamId,
                    outFile: node_path_1.default.join(jobData.publish.outDir, jobData.export.filename)
                }
            });
        }
        if (jobData.save?.file) {
            tasks.push({
                action: 'file',
                params: {
                    file: jobData.export.filename,
                    out: node_path_1.default.join(jobData.save.file.outDir, jobData.export.filename)
                }
            });
        }
        if (jobData.save?.s3) {
            tasks.push({
                action: 's3',
                params: {
                    acl: jobData.save.s3.acl,
                    bucket: jobData.save.s3.bucket,
                    file: jobData.export.filename,
                    path: `${jobData.save.s3.dirPath}/${jobData.export.filename}`
                }
            });
        }
        return await this.create({
            chartId: jobData.chartId,
            userId: jobData.userId,
            tasks
        }, options);
    }
}
exports.RenderNetworkClient = RenderNetworkClient;
