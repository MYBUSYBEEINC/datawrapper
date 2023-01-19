import type { ConfigTypes, WorkerTypes } from '@datawrapper/backend-utils';
import type { DB } from '@datawrapper/orm';
import type { QueueEvents } from 'bullmq';
import { ExportChartJobData, JobCreationResult, JobsCreationResult } from './types';
export declare type BullmqQueueEventsClass = typeof QueueEvents;
export declare type ServerConfig = {
    worker?: {
        redis?: {
            host: string;
            port: string | number;
            password?: string;
        };
        queues?: ConfigTypes.WorkerQueuesConfig;
    };
};
export declare class WorkerClient {
    private readonly Queue;
    private readonly QueueEvents;
    private readonly workerConfig;
    private readonly db;
    constructor(serverConfig: ServerConfig, Queue: WorkerTypes.BullmqQueueClass, QueueEvents: BullmqQueueEventsClass, db: DB);
    get queues(): ConfigTypes.WorkerQueuesConfig;
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
