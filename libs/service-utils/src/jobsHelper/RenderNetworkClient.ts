import type { ExportJobModel } from '@datawrapper/orm';
import type { ExportJob } from '@datawrapper/orm/db';
import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';
import { groupBy } from 'lodash';
import path from 'node:path';
import {
    AnyFormatJobData,
    ExportChartJobData,
    ExportFilesPublishOptions,
    ExportFilesS3Options,
    ExportFilesSaveOptions,
    ExportFormat,
    Filename,
    InvalidateCloudflareJobData,
    JobCompletionError,
    JobCreationResult,
    JobsCreationResult,
    PdfJobData,
    PngJobData,
    SvgJobData
} from './types';

type ExportJobType = typeof ExportJob;

type ChartPdfExportTaskOptions = {
    out: Filename<ExportFormat.PDF>;
    mode: Parameters<ExportPrint['pdf']>[0]['colorMode'];
} & Pick<
    Parameters<ExportPrint['pdf']>[0],
    | 'width'
    | 'height'
    | 'plain'
    | 'logo'
    | 'logoId'
    | 'unit'
    | 'scale'
    | 'border'
    | 'transparent'
    | 'fullVector'
    | 'ligatures'
    | 'dark'
> &
    Partial<Pick<Parameters<ExportPrint['pdf']>[0], 'delay'>>;

type ChartSvgExportTaskOptions = {
    out: Filename<ExportFormat.SVG>;
} & Pick<
    Parameters<ExportPrint['svg']>[0],
    | 'width'
    | 'height'
    | 'plain'
    | 'logo'
    | 'logoId'
    | 'fullVector'
    | 'delay'
    | 'dark'
    | 'transparent'
>;

type ChartPngExportTaskOptions = {
    sizes: {
        width: number;
        height: number | 'auto';
        out: Filename<ExportFormat.PNG>;
        zoom: number;
        plain: boolean;
        transparent: boolean;
        published?: boolean;
        logo: string | undefined;
        logoId: string | undefined;
        dark: boolean;
    }[];
};

type GenericTask<TAction extends string, TParams> = {
    action: TAction;
    params: TParams;
};

type Task =
    | GenericTask<'cloudflare', { urls: string[] }>
    | GenericTask<'pdf', ChartPdfExportTaskOptions>
    | GenericTask<'png', ChartPngExportTaskOptions>
    | GenericTask<'svg', ChartSvgExportTaskOptions>
    | GenericTask<
          'border',
          {
              image: Filename<ExportFormat.PNG>;
              out: Filename<ExportFormat.PNG>;
              padding: number;
              color: string;
          }
      >
    | GenericTask<'exif', { image: Filename<ExportFormat.PNG>; tags: Record<string, string> }>
    | GenericTask<'file', { file: Filename<ExportFormat>; out: string }>
    | GenericTask<
          'publish',
          { file: Filename<ExportFormat>; teamId: string | null; outFile: string }
      >
    | GenericTask<
          's3',
          {
              file: Filename<ExportFormat>;
              bucket: string;
              path: string;
              acl: 'private' | 'public-read';
          }
      >;

export type ExportJobOptions = {
    key: string;
    priority: number;
};

type JobData = {
    chartId: string | null;
    userId: number | null;
    tasks: Task[];
};

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

const createPdfTasks = (exports: PdfJobData[]): Task[] =>
    exports.map(data => {
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

const createSvgTasks = (exports: SvgJobData[]): Task[] =>
    exports.map(data => ({
        action: 'svg',
        params: {
            ...data.options,
            out: data.filename
        }
    }));

const createPngTasks = (exports: PngJobData[]): Task[] => [
    {
        action: 'png',
        params: {
            sizes:
                exports.map(data => ({
                    ...data.options,
                    out: data.filename
                })) ?? []
        }
    },
    ...exports.flatMap(data => {
        const subTasks: Task[] = [];

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

const createExportFilePublishTasks = (
    publishOptions: ExportFilesPublishOptions,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 'publish',
        params: {
            file: filename,
            teamId: publishOptions.teamId,
            outFile: path.join(publishOptions.outDir, filename)
        }
    }));

const createExportFileSaveTasks = (
    saveOptions: ExportFilesSaveOptions,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 'file',
        params: {
            file: filename,
            out: path.join(saveOptions.outDir, filename)
        }
    }));

const createExportFileS3Tasks = (
    s3Options: ExportFilesS3Options,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 's3',
        params: {
            acl: s3Options.acl,
            bucket: s3Options.bucket,
            file: filename,
            path: `${s3Options.dirPath}/${filename}`
        }
    }));

export class RenderNetworkClient {
    private readonly ExportJob: ExportJobType;

    constructor(ExportJob: ExportJobType) {
        this.ExportJob = ExportJob;
    }

    private async bulkCreate<TOptions extends ExportJobOptions>(
        bulkJobData: JobData[],
        options: TOptions
    ): JobsCreationResult<void> {
        const jobs = await this.ExportJob.bulkCreate(
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
                tasks: [
                    {
                        action: 'cloudflare',
                        params: {
                            urls
                        }
                    }
                ]
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
        const saveOptions = jobData.save?.file;
        const s3Options = jobData.save?.s3;
        const exportsByType: {
            [key in ExportFormat]?: Extract<AnyFormatJobData, { format: key }>[];
        } = groupBy(jobData.exports, data => data.format);

        return await this.create(
            {
                chartId: jobData.chartId,
                userId: jobData.userId,
                tasks: [
                    ...Object.keys(exportsByType).flatMap(format => {
                        switch (format) {
                            case ExportFormat.PDF:
                                return createPdfTasks(exportsByType[format]!);

                            case ExportFormat.SVG:
                                return createSvgTasks(exportsByType[format]!);

                            case ExportFormat.PNG:
                                return createPngTasks(exportsByType[format]!);

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
            },
            options
        );
    }
}
