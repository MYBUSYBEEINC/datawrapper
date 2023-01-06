"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderNetworkClient = void 0;
const lodash_1 = require("lodash");
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
const createPdfTasks = (exports) => exports.map(data => {
    const { colorMode, ...pdfOptions } = data.options;
    return {
        action: 'pdf',
        params: {
            ...pdfOptions,
            mode: colorMode,
            out: data.filename
        }
    };
});
const createSvgTasks = (exports) => exports.map(data => ({
    action: 'svg',
    params: {
        ...data.options,
        out: data.filename
    }
}));
const createPngTasks = (exports) => [
    {
        action: 'png',
        params: {
            sizes: exports.map(data => ({
                ...data.options,
                out: data.filename
            })) ?? []
        }
    },
    ...exports.flatMap(data => {
        const subTasks = [];
        if (data.border) {
            subTasks.push({
                action: 'border',
                params: {
                    ...data.border,
                    image: data.filename,
                    out: data.filename
                }
            });
        }
        if (data.exif) {
            subTasks.push({
                action: 'exif',
                params: {
                    ...data.exif,
                    image: data.filename
                }
            });
        }
        return subTasks;
    })
];
const createExportFilePublishTasks = (publishOptions, filenames) => filenames.map(filename => ({
    action: 'publish',
    params: {
        file: filename,
        teamId: publishOptions.teamId,
        outFile: node_path_1.default.join(publishOptions.outDir, filename)
    }
}));
const createExportFileSaveTasks = (saveOptions, filenames) => filenames.map(filename => ({
    action: 'file',
    params: {
        file: filename,
        out: node_path_1.default.join(saveOptions.outDir, filename)
    }
}));
const createExportFileS3Tasks = (s3Options, filenames) => filenames.map(filename => ({
    action: 's3',
    params: {
        acl: s3Options.acl,
        bucket: s3Options.bucket,
        file: filename,
        path: `${s3Options.dirPath}/${filename}`
    }
}));
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
        const exportFilenames = jobData.exports.map(({ filename }) => filename);
        const publishOptions = jobData.publish;
        const saveOptions = jobData.save?.file;
        const s3Options = jobData.save?.s3;
        const exportsByType = (0, lodash_1.groupBy)(jobData.exports, data => data.format);
        return await this.create({
            chartId: jobData.chartId,
            userId: jobData.userId,
            tasks: [
                ...Object.keys(exportsByType).flatMap(format => {
                    switch (format) {
                        case types_1.ExportFormat.PDF:
                            return createPdfTasks(exportsByType[format]);
                        case types_1.ExportFormat.SVG:
                            return createSvgTasks(exportsByType[format]);
                        case types_1.ExportFormat.PNG:
                            return createPngTasks(exportsByType[format]);
                        default:
                            throw new Error(`Unsupported format ${format}`);
                    }
                }),
                ...(publishOptions
                    ? createExportFilePublishTasks(publishOptions, exportFilenames)
                    : []),
                ...(saveOptions ? createExportFileSaveTasks(saveOptions, exportFilenames) : []),
                ...(s3Options ? createExportFileS3Tasks(s3Options, exportFilenames) : [])
            ]
        }, options);
    }
}
exports.RenderNetworkClient = RenderNetworkClient;
