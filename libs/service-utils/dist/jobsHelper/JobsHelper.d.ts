import type { WorkerTypes } from '@datawrapper/backend-utils';
import type { DB } from '@datawrapper/orm';
import { ExportJobOptions } from './RenderNetworkClient';
import type { ExportChartJobData, InvalidateCloudflareJobData } from './types';
import { WorkerClient, BullmqQueueEventsClass, ServerConfig } from './WorkerClient';
export declare class JobsHelper {
    readonly workerClient?: WorkerClient;
    private readonly renderNetworkClient;
    constructor(config: ServerConfig, Queue: WorkerTypes.BullmqQueueClass, QueueEvents: BullmqQueueEventsClass, db: DB, onError: (e: unknown) => void);
    scheduleInvalidateCloudflareJobs(bulkJobData: InvalidateCloudflareJobData[], renderNetworkParams: ExportJobOptions): Promise<{
        getResults(maxSecondsInQueue?: number | undefined): Promise<void>[];
    }>;
    scheduleInvalidateCloudflareJob(jobData: InvalidateCloudflareJobData, renderNetworkParams: ExportJobOptions): Promise<{
        getResult(maxSecondsInQueue?: number | undefined): Promise<void>;
    }>;
    scheduleChartExport(jobData: ExportChartJobData, renderNetworkParams: ExportJobOptions): Promise<{
        getResult(maxSecondsInQueue?: number | undefined): Promise<void>;
    }>;
}
