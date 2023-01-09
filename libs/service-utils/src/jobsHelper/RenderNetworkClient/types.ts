import type { ExportPrint } from '@datawrapper/shared/exportPrintTypes';
import type { ExportFormat, Filename } from '../types';

type ChartPdfExportTaskOptions = {
    out: Filename<ExportFormat.PDF>;
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
    out: Filename<ExportFormat.SVG>;
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
        out: Filename<ExportFormat.PNG>;
        zoom: number;
        plain: boolean;
        transparent: boolean;
        published?: boolean;
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
              image: Filename<ExportFormat.PNG>;
              out: Filename<ExportFormat.PNG>;
              padding: number;
              color: string;
          }
      >
    | GenericTask<'exif', { image: Filename<ExportFormat.PNG>; tags: Record<string, string> }>
    | GenericTask<'file', { file: Filename<ExportFormat>; out: string }>
    | GenericTask<
          'publish',
          { file: Filename<ExportFormat>; teamId: string | null; outFile: string }
      >
    | GenericTask<
          's3',
          {
              file: Filename<ExportFormat>;
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
