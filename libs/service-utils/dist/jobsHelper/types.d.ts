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
export declare type PdfJobData = {
    format: ExportFormat.PDF;
    filename: Filename<ExportFormat.PDF>;
    options: Pick<Parameters<ExportPrint['pdf']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'unit' | 'scale' | 'border' | 'transparent' | 'colorMode' | 'fullVector' | 'ligatures' | 'dark'>;
};
export declare type SvgJobData = {
    format: ExportFormat.SVG;
    filename: Filename<ExportFormat.SVG>;
    options: Pick<Parameters<ExportPrint['svg']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'fullVector' | 'dark' | 'transparent'>;
};
export declare type PngJobData = {
    format: ExportFormat.PNG;
    filename: Filename<ExportFormat.PNG>;
    options: {
        width: number;
        height: number | 'auto';
        zoom: number;
        plain: boolean;
        transparent: boolean;
        logo: string | undefined;
        logoId: string | undefined;
        dark: boolean;
    };
    border?: {
        padding: number;
        color: string;
    } | undefined;
    compress: boolean;
    exif?: {
        tags: Record<string, string>;
    } | undefined;
};
export declare type AnyFormatJobData = PdfJobData | SvgJobData | PngJobData;
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
    chartId: string;
    userId: number;
    exports: AnyFormatJobData[];
    publish?: ExportFilesPublishOptions;
    save?: {
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
