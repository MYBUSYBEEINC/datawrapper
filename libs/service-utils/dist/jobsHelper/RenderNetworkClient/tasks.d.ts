import type { ExportChartTypes } from '@datawrapper/backend-utils';
import type { ExportFilesPublishOptions, ExportFilesS3Options } from '../types';
import type { Task } from './types';
export declare const createCloudflareInvalidateTask: (urls: string[]) => Task;
export declare const createPdfTasks: (exports: ExportChartTypes.PdfJobData[]) => Task[];
export declare const createSvgTasks: (exports: ExportChartTypes.SvgJobData[]) => Task[];
export declare const createPngTasks: (exports: ExportChartTypes.PngJobData[]) => Task[];
export declare const createExportFilePublishTasks: (publishOptions: ExportFilesPublishOptions, filenames: ExportChartTypes.Filename<ExportChartTypes.ExportFormat>[]) => Task[];
export declare const createExportFileS3Tasks: (s3Options: ExportFilesS3Options, filenames: ExportChartTypes.Filename<ExportChartTypes.ExportFormat>[]) => Task[];
