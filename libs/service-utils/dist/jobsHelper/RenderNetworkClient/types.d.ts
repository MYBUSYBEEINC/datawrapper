import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';
declare type PdfFilename = `${string}.pdf`;
declare type SvgFilename = `${string}.svg`;
declare type PngFilename = `${string}.png`;
declare type Filename = PdfFilename | SvgFilename | PngFilename;
declare type ChartPdfExportTaskOptions = {
    out: PdfFilename;
    mode: Parameters<ExportPrint['pdf']>[0]['colorMode'];
} & Pick<Parameters<ExportPrint['pdf']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'unit' | 'scale' | 'border' | 'transparent' | 'fullVector' | 'ligatures' | 'dark'> & Partial<Pick<Parameters<ExportPrint['pdf']>[0], 'delay'>>;
declare type ChartSvgExportTaskOptions = {
    out: SvgFilename;
} & Pick<Parameters<ExportPrint['svg']>[0], 'width' | 'height' | 'plain' | 'logo' | 'logoId' | 'fullVector' | 'delay' | 'dark' | 'transparent'>;
declare type ChartPngExportTaskOptions = {
    sizes: {
        width: number;
        height: number | 'auto';
        out: PngFilename;
        zoom: number;
        plain: boolean;
        transparent: boolean;
        logo: string | undefined;
        logoId: string | undefined;
        dark: boolean;
    }[];
};
declare type GenericTask<TAction extends string, TParams> = {
    action: TAction;
    params: TParams;
};
export declare type Task = GenericTask<'cloudflare', {
    urls: string[];
}> | GenericTask<'pdf', ChartPdfExportTaskOptions> | GenericTask<'png', ChartPngExportTaskOptions> | GenericTask<'svg', ChartSvgExportTaskOptions> | GenericTask<'border', {
    image: PngFilename;
    out: PngFilename;
    padding: number;
    color: string;
}> | GenericTask<'compress', {
    image: PngFilename;
}> | GenericTask<'exif', {
    image: PngFilename;
    tags: Record<string, string>;
}> | GenericTask<'publish', {
    file: Filename;
    teamId: string | null;
    outFile: string;
}> | GenericTask<'s3', {
    file: Filename;
    bucket: string;
    path: string;
    acl: 'private' | 'public-read';
}>;
export declare type ExportJobOptions = {
    key: string;
    priority: number;
};
export declare type JobData = {
    chartId: string | null;
    userId: number | null;
    tasks: Task[];
};
export {};
