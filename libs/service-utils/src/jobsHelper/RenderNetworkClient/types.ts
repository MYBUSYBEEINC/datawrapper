import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';

type PdfFilename = `${string}.pdf`;
type SvgFilename = `${string}.svg`;
type PngFilename = `${string}.png`;
type Filename = PdfFilename | SvgFilename | PngFilename;

type ChartPdfExportTaskOptions = {
    out: PdfFilename;
    mode: Parameters<ExportPrint['pdf']>[0]['colorMode'];
} & Pick<
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
    | 'fullVector'
    | 'ligatures'
    | 'dark'
> &
    Partial<Pick<Parameters<ExportPrint['pdf']>[0], 'delay'>>;

type ChartSvgExportTaskOptions = {
    out: SvgFilename;
} & Pick<
    Parameters<ExportPrint['svg']>[0],
    | 'width'
    | 'height'
    | 'plain'
    | 'logo'
    | 'logoId'
    | 'fullVector'
    | 'delay'
    | 'dark'
    | 'transparent'
>;

type ChartPngExportTaskOptions = {
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

type GenericTask<TAction extends string, TParams> = {
    action: TAction;
    params: TParams;
};

export type Task =
    | GenericTask<'cloudflare', { urls: string[] }>
    | GenericTask<'pdf', ChartPdfExportTaskOptions>
    | GenericTask<'png', ChartPngExportTaskOptions>
    | GenericTask<'svg', ChartSvgExportTaskOptions>
    | GenericTask<
          'border',
          {
              image: PngFilename;
              out: PngFilename;
              padding: number;
              color: string;
          }
      >
    | GenericTask<'compress', { image: PngFilename }>
    | GenericTask<'exif', { image: PngFilename; tags: Record<string, string> }>
    | GenericTask<'publish', { file: Filename; teamId: string | null; outFile: string }>
    | GenericTask<
          's3',
          {
              file: Filename;
              bucket: string;
              path: string;
              acl: 'private' | 'public-read';
          }
      >;

export type ExportJobOptions = {
    key: string;
    priority: number;
};

export type JobData = {
    chartId: string | null;
    userId: number | null;
    tasks: Task[];
};
