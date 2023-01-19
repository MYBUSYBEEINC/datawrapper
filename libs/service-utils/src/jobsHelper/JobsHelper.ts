import type { WorkerTypes } from '@datawrapper/backend-utils';
import type { DB } from '@datawrapper/orm';
import { ExportJobOptions, RenderNetworkClient } from './RenderNetworkClient';
import type { ExportChartJobData, InvalidateCloudflareJobData } from './types';
import { WorkerClient, BullmqQueueEventsClass, ServerConfig } from './WorkerClient';

export class JobsHelper {
    public readonly workerClient?: WorkerClient;
    private readonly renderNetworkClient: RenderNetworkClient;

    constructor(
        config: ServerConfig,
        Queue: WorkerTypes.BullmqQueueClass,
        QueueEvents: BullmqQueueEventsClass,
        db: DB,
        onError: (e: unknown) => void
    ) {
        this.renderNetworkClient = new RenderNetworkClient(db);
        try {
            this.workerClient = new WorkerClient(config, Queue, QueueEvents, db);
        } catch (e) {
            onError(e);
        }
    }

    async scheduleInvalidateCloudflareJobs(
        bulkJobData: InvalidateCloudflareJobData[],
        renderNetworkParams: ExportJobOptions
    ) {
        const queueName = 'compute';
        if (this.workerClient?.queues[queueName]) {
            return await this.workerClient.scheduleJobs(
                queueName,
                'invalidateCloudflareCache',
                bulkJobData
            );
        }

        return await this.renderNetworkClient.scheduleInvalidateCloudflareJobs(
            bulkJobData,
            renderNetworkParams
        );
    }

    async scheduleInvalidateCloudflareJob(
        jobData: InvalidateCloudflareJobData,
        renderNetworkParams: ExportJobOptions
    ) {
        const queueName = 'compute';
        if (this.workerClient?.queues[queueName]) {
            return await this.workerClient.scheduleJob(
                queueName,
                'invalidateCloudflareCache',
                jobData
            );
        }

        return await this.renderNetworkClient.scheduleInvalidateCloudflareJob(
            jobData,
            renderNetworkParams
        );
    }

    async scheduleChartExport(jobData: ExportChartJobData, renderNetworkParams: ExportJobOptions) {
        const queueName = 'render';
        if (this.workerClient?.queues[queueName]) {
            return await this.workerClient.scheduleChartExport(queueName, jobData);
        }
        return await this.renderNetworkClient.scheduleChartExport(jobData, renderNetworkParams);
    }
}
