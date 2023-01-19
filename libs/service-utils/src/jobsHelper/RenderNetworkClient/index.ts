import { ExportChartTypes } from '@datawrapper/backend-utils';
import type { DB, ExportJobModel } from '@datawrapper/orm';
import { groupBy } from 'lodash';
import {
    ExportChartJobData,
    InvalidateCloudflareJobData,
    JobCompletionError,
    JobCreationResult,
    JobsCreationResult
} from '../types';
import {
    createCloudflareInvalidateTask,
    createExportFilePublishTasks,
    createExportFileS3Tasks,
    createPdfTasks,
    createPngTasks,
    createSvgTasks
} from './tasks';
import type { ExportJobOptions, JobData } from './types';
export type { ExportJobOptions } from './types';

const waitForJobCompletion = (job: ExportJobModel, maxSecondsInQueue: number | undefined) => {
    // todo keep request open until result
    const deadline = Date.now() + (maxSecondsInQueue ?? 0) * 1000;

    return new Promise<void>((resolve, reject) => {
        (function checkResult() {
            job.reload().then(job => {
                if (job.status === 'done') {
                    return resolve();
                }

                if (job.status === 'failed') {
                    return reject(new JobCompletionError('failed'));
                }

                if (job.status === 'queued' && maxSecondsInQueue && Date.now() > deadline) {
                    job.status = 'done';
                    job.done_at = new Date();
                    job.save();

                    return reject(new JobCompletionError('timeout'));
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

export class RenderNetworkClient {
    private readonly db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    private async bulkCreate<TOptions extends ExportJobOptions>(
        bulkJobData: JobData[],
        options: TOptions
    ): JobsCreationResult<void> {
        const jobs = await this.db.models.export_job.bulkCreate(
            bulkJobData.map(({ chartId, userId, tasks }) => ({
                key: options.key,
                priority: options.priority,
                chart_id: chartId,
                user_id: userId,
                tasks
            }))
        );

        return {
            getResults: maxSecondsInQueue =>
                jobs.map(job => waitForJobCompletion(job, maxSecondsInQueue))
        };
    }

    private async create<TOptions extends ExportJobOptions>(
        { chartId, userId, tasks }: JobData,
        options: TOptions
    ): JobCreationResult<void> {
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

    async scheduleInvalidateCloudflareJobs<TOptions extends ExportJobOptions>(
        bulkJobData: InvalidateCloudflareJobData[],
        options: TOptions
    ) {
        return await this.bulkCreate(
            bulkJobData.map(({ chartId, userId, urls }) => ({
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
            })),
            options
        );
    }

    async scheduleInvalidateCloudflareJob<TOptions extends ExportJobOptions>(
        { chartId, userId, urls }: InvalidateCloudflareJobData,
        options: TOptions
    ) {
        return await this.create(
            {
                chartId,
                userId,
                tasks: [createCloudflareInvalidateTask(urls)]
            },
            options
        );
    }

    async scheduleChartExport<TOptions extends ExportJobOptions>(
        jobData: ExportChartJobData,
        options: TOptions
    ) {
        const exportFilenames = jobData.exports.map(({ filename }) => filename);
        const publishOptions = jobData.publish;
        const s3Options = jobData.upload?.s3;
        const exportsByType: {
            [key in ExportChartTypes.ExportFormat]?: Extract<
                ExportChartTypes.AnyFormatJobData,
                { format: key }
            >[];
        } = groupBy(jobData.exports, data => data.format);

        return await this.create(
            {
                chartId: jobData.chart.id,
                userId: jobData.userId,
                tasks: [
                    ...Object.keys(exportsByType).flatMap(format => {
                        switch (format) {
                            case ExportChartTypes.ExportFormat.PDF:
                                return createPdfTasks(exportsByType[format]!);

                            case ExportChartTypes.ExportFormat.SVG:
                                return createSvgTasks(exportsByType[format]!);

                            case ExportChartTypes.ExportFormat.PNG:
                                return createPngTasks(exportsByType[format]!);

                            default:
                                throw new Error(`Unsupported format ${format}`);
                        }
                    }),
                    ...(publishOptions
                        ? createExportFilePublishTasks(publishOptions, exportFilenames)
                        : []),
                    ...(s3Options ? createExportFileS3Tasks(s3Options, exportFilenames) : [])
                ]
            },
            options
        );
    }
}
