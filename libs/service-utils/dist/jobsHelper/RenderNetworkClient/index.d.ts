import type { DB } from '@datawrapper/orm';
import { ExportChartJobData, InvalidateCloudflareJobData } from '../types';
import type { ExportJobOptions } from './types';
export type { ExportJobOptions } from './types';
export declare class RenderNetworkClient {
    private readonly db;
    constructor(db: DB);
    private bulkCreate;
    private create;
    scheduleInvalidateCloudflareJobs<TOptions extends ExportJobOptions>(bulkJobData: InvalidateCloudflareJobData[], options: TOptions): Promise<{
        getResults(maxSecondsInQueue?: number | undefined): Promise<void>[];
    }>;
    scheduleInvalidateCloudflareJob<TOptions extends ExportJobOptions>({ chartId, userId, urls }: InvalidateCloudflareJobData, options: TOptions): Promise<{
        getResult(maxSecondsInQueue?: number | undefined): Promise<void>;
    }>;
    scheduleChartExport<TOptions extends ExportJobOptions>(jobData: ExportChartJobData, options: TOptions): Promise<{
        getResult(maxSecondsInQueue?: number | undefined): Promise<void>;
    }>;
}
