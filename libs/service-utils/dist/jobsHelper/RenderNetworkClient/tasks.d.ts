import { ExportFilesPublishOptions, ExportFilesS3Options, ExportFormat, Filename, PdfJobData, PngJobData, SvgJobData } from '../types';
import type { Task } from './types';
export declare const createCloudflareInvalidateTask: (urls: string[]) => Task;
export declare const createPdfTasks: (exports: PdfJobData[]) => Task[];
export declare const createSvgTasks: (exports: SvgJobData[]) => Task[];
export declare const createPngTasks: (exports: PngJobData[]) => Task[];
export declare const createExportFilePublishTasks: (publishOptions: ExportFilesPublishOptions, filenames: Filename<ExportFormat>[]) => Task[];
export declare const createExportFileS3Tasks: (s3Options: ExportFilesS3Options, filenames: Filename<ExportFormat>[]) => Task[];
