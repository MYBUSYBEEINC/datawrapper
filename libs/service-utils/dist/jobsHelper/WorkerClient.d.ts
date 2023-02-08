import type { Config, ExportChartTypes, WorkerTypes } from '@datawrapper/backend-utils';
import type { DB } from '@datawrapper/orm';
import type { QueueEvents } from 'bullmq';
import { ExportChartJobData, JobCreationResult, JobsCreationResult } from './types';
export declare type BullmqQueueEventsClass = typeof QueueEvents;
export declare class WorkerClient {
    private readonly db;
    readonly queues: {
        [x: string]: import("bullmq").Queue<{
            name: string;
        } | {
            chartId: string;
            accessToken: string;
            exports: ExportChartTypes.AnyFormatJobData[];
            upload: ExportChartTypes.UploadFilesAnyOptions[];
        } | {
            urls: string[];
        }, void | string[], keyof {
            hello: {
                data: {
                    name: string;
                };
                result: string[];
            };
            exportChart: {
                data: {
                    chartId: string;
                    accessToken: string;
                    exports: ExportChartTypes.AnyFormatJobData[];
                    upload: ExportChartTypes.UploadFilesAnyOptions[];
                };
                result: void;
            };
            invalidateCloudflareCache: {
                data: {
                    urls: string[];
                };
                result: void;
            };
        }>;
    };
    private readonly queuesEvents;
    constructor(serverConfig: Config, Queue: WorkerTypes.BullmqQueueClass, QueueEvents: BullmqQueueEventsClass, db: DB);
    scheduleJob<TName extends WorkerTypes.JobName>(queueName: string, jobType: TName, jobPayload: WorkerTypes.JobData<TName>): JobCreationResult<WorkerTypes.JobResult<TName>>;
    scheduleJobs<TName extends WorkerTypes.JobName>(queueName: string, jobType: TName, jobPayloads: WorkerTypes.JobData<TName>[]): JobsCreationResult<WorkerTypes.JobResult<TName>>;
    scheduleJobAndWaitForResults<TName extends WorkerTypes.JobName>(queueName: string, jobType: TName, jobPayload: WorkerTypes.JobData<TName>): Promise<WorkerTypes.JobResult<TName>>;
    scheduleChartExport(queueName: string, { chart, userId, ...jobData }: ExportChartJobData): JobCreationResult<WorkerTypes.JobResult<'exportChart'>>;
    getQueueHealth(queueName: string, jobsSampleSize: number): Promise<{
        connected: boolean;
        paused?: boolean;
        numWorkers?: number;
        idle?: boolean;
        jobs?: {
            numFinished?: number;
            numCompleted?: number;
            ratioCompleted?: number;
        };
        lastJobFinishedAgoMs?: number;
    }>;
}
