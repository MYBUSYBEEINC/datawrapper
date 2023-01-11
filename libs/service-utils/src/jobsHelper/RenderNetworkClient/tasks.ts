import path from 'node:path';
import {
    ExportFilesPublishOptions,
    ExportFilesS3Options,
    ExportFilesSaveOptions,
    ExportFormat,
    Filename,
    PdfJobData,
    PngJobData,
    SvgJobData
} from '../types';
import type { Task } from './types';

export const createCloudflareInvalidateTask = (urls: string[]): Task => ({
    action: 'cloudflare',
    params: {
        urls
    }
});

export const createPdfTasks = (exports: PdfJobData[]): Task[] =>
    exports.map(data => {
        const { colorMode, ...pdfOptions } = data.options;
        return {
            action: ExportFormat.PDF,
            params: {
                ...pdfOptions,
                mode: colorMode,
                out: data.filename
            }
        };
    });

export const createSvgTasks = (exports: SvgJobData[]): Task[] =>
    exports.map(data => ({
        action: ExportFormat.SVG,
        params: {
            ...data.options,
            out: data.filename
        }
    }));

export const createPngTasks = (exports: PngJobData[]): Task[] => [
    {
        action: ExportFormat.PNG,
        params: {
            sizes:
                exports.map(data => ({
                    ...data.options,
                    out: data.filename
                })) ?? []
        }
    },
    ...exports.flatMap(data => {
        const subTasks: Task[] = [];

        if (data.border) {
            subTasks.push({
                action: 'border',
                params: {
                    ...data.border,
                    image: data.filename,
                    out: data.filename
                }
            });
        }

        if (data.compress) {
            subTasks.push({
                action: 'compress',
                params: {
                    image: data.filename
                }
            });
        }

        if (data.exif) {
            subTasks.push({
                action: 'exif',
                params: {
                    ...data.exif,
                    image: data.filename
                }
            });
        }

        return subTasks;
    })
];

export const createExportFilePublishTasks = (
    publishOptions: ExportFilesPublishOptions,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 'publish',
        params: {
            file: filename,
            teamId: publishOptions.teamId,
            outFile: path.join(publishOptions.outDir, filename)
        }
    }));

export const createExportFileSaveTasks = (
    saveOptions: ExportFilesSaveOptions,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 'file',
        params: {
            file: filename,
            out: path.join(saveOptions.outDir, filename)
        }
    }));

export const createExportFileS3Tasks = (
    s3Options: ExportFilesS3Options,
    filenames: Filename<ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 's3',
        params: {
            acl: s3Options.acl,
            bucket: s3Options.bucket,
            file: filename,
            path: `${s3Options.dirPath}/${filename}`
        }
    }));
