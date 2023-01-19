import type { ExportChartTypes } from '@datawrapper/backend-utils';
import type { ChartModel } from '@datawrapper/orm';
export declare type InvalidateCloudflareJobData = {
    chartId: string | null;
    userId: number | null;
    urls: string[];
};
export declare type ExportFilesPublishOptions = {
    teamId: string | null;
    outDir: string;
};
export declare type ExportFilesS3Options = {
    bucket: string;
    dirPath: string;
    acl: 'private' | 'public-read';
};
export declare type ExportChartJobData = {
    chart: ChartModel;
    userId: number;
    exports: ExportChartTypes.AnyFormatJobData[];
    publish?: ExportFilesPublishOptions;
    upload?: {
        s3?: ExportFilesS3Options | undefined;
    };
};
declare type JobCompletionErrorCode = 'failed' | 'timeout';
export declare class JobCompletionError extends Error {
    readonly code: JobCompletionErrorCode;
    constructor(code: JobCompletionErrorCode);
}
export declare type JobCreationResult<TReturn> = Promise<{
    getResult(maxSecondsInQueue?: number): Promise<TReturn>;
}>;
export declare type JobsCreationResult<TReturn> = Promise<{
    getResults(maxSecondsInQueue?: number): Promise<TReturn>[];
}>;
export {};
