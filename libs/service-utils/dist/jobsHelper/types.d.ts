import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';
export declare type InvalidateCloudflareJobData = {
    chartId: string | null;
    userId: number | null;
    urls: string[];
};
export declare enum ExportFormat {
    PDF = "pdf",
    PNG = "png",
    SVG = "svg"
}
export declare type Filename<TFormat extends ExportFormat> = `${string}.${TFormat}`;
declare type PdfJobData = {
    format: ExportFormat.PDF;
    filename: Filename<ExportFormat.PDF>;
    options: Pick<Parameters<ExportPrint['pdf']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'unit' | 'scale' | 'border' | 'transparent' | 'colorMode' | 'fullVector' | 'ligatures' | 'dark'>;
};
declare type SvgJobData = {
    format: ExportFormat.SVG;
    filename: Filename<ExportFormat.SVG>;
    options: Pick<Parameters<ExportPrint['svg']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'fullVector' | 'dark' | 'transparent'>;
};
declare type PngJobData = {
    format: ExportFormat.PNG;
    filename: Filename<ExportFormat.PNG>;
    options: {
        width: number;
        height: number | 'auto';
        zoom: number;
        plain: boolean;
        transparent: boolean;
        published?: boolean;
        logo: string | undefined;
        logoId: string | undefined;
        dark: boolean;
    };
    border?: {
        padding: number;
        color: string;
    } | undefined;
    exif: {
        tags: Record<string, string>;
    };
};
export declare type ExportChartJobData = {
    chartId: string;
    userId: number;
    export: PdfJobData | SvgJobData | PngJobData;
    publish?: {
        teamId: string | null;
        outDir: string;
    };
    save?: {
        s3?: {
            bucket: string;
            dirPath: string;
            acl: 'private' | 'public-read';
        };
        file?: {
            outDir: string;
        };
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
