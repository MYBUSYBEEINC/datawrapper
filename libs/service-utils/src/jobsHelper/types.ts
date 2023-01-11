import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';

export type InvalidateCloudflareJobData = {
    chartId: string | null;
    userId: number | null;
    urls: string[];
};

export enum ExportFormat {
    PDF = 'pdf',
    PNG = 'png',
    SVG = 'svg'
}

export type Filename<TFormat extends ExportFormat> = `${string}.${TFormat}`;

export type PdfJobData = {
    format: ExportFormat.PDF;
    filename: Filename<ExportFormat.PDF>;
    options: Pick<
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
        | 'colorMode'
        | 'fullVector'
        | 'ligatures'
        | 'dark'
    >;
};

export type SvgJobData = {
    format: ExportFormat.SVG;
    filename: Filename<ExportFormat.SVG>;
    options: Pick<
        Parameters<ExportPrint['svg']>[0],
        'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'fullVector' | 'dark' | 'transparent'
    >;
};

export type PngJobData = {
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
    border?:
        | {
              padding: number;
              color: string;
          }
        | undefined;
    compress: boolean;
    exif?:
        | {
              tags: Record<string, string>;
          }
        | undefined;
};

export type AnyFormatJobData = PdfJobData | SvgJobData | PngJobData;

export type ExportFilesPublishOptions = {
    teamId: string | null;
    outDir: string;
};

export type ExportFilesS3Options = {
    bucket: string;
    dirPath: string;
    acl: 'private' | 'public-read';
};

export type ExportFilesSaveOptions = {
    outDir: string;
};

export type ExportChartJobData = {
    chartId: string;
    userId: number;
    exports: AnyFormatJobData[];
    publish?: ExportFilesPublishOptions;
    save?: {
        s3?: ExportFilesS3Options | undefined;
        file?: ExportFilesSaveOptions | undefined;
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
