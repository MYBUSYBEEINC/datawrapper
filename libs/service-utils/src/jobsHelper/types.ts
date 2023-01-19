import type { ExportChartTypes } from '@datawrapper/backend-utils';
import type { ChartModel } from '@datawrapper/orm';

export type InvalidateCloudflareJobData = {
    chartId: string | null;
    userId: number | null;
    urls: string[];
};

export type ExportFilesPublishOptions = {
    teamId: string | null;
    outDir: string;
};

export type ExportFilesS3Options = {
    bucket: string;
    dirPath: string;
    acl: 'private' | 'public-read';
};

export type ExportChartJobData = {
    chart: ChartModel;
    userId: number;
    exports: ExportChartTypes.AnyFormatJobData[];
    publish?: ExportFilesPublishOptions;
    upload?: {
        s3?: ExportFilesS3Options | undefined;
    };
};

type JobCompletionErrorCode = 'failed' | 'timeout';

export class JobCompletionError extends Error {
    constructor(public readonly code: JobCompletionErrorCode) {
        super();
    }
}

export type JobCreationResult<TReturn> = Promise<{
    getResult(maxSecondsInQueue?: number): Promise<TReturn>;
}>;

export type JobsCreationResult<TReturn> = Promise<{
    getResults(maxSecondsInQueue?: number): Promise<TReturn>[];
}>;
