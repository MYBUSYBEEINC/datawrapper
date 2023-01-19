import type { ExportChartTypes } from '@datawrapper/backend-utils';
import path from 'node:path';
import type { ExportFilesPublishOptions, ExportFilesS3Options } from '../types';
import type { Task } from './types';

export const createCloudflareInvalidateTask = (urls: string[]): Task => ({
    action: 'cloudflare',
    params: {
        urls
    }
});

export const createPdfTasks = (exports: ExportChartTypes.PdfJobData[]): Task[] =>
    exports.map(data => {
        const { colorMode, ...pdfOptions } = data.options;
        return {
            action: 'pdf',
            params: {
                ...pdfOptions,
                mode: colorMode,
                out: data.filename
            }
        };
    });

export const createSvgTasks = (exports: ExportChartTypes.SvgJobData[]): Task[] =>
    exports.map(data => ({
        action: 'svg',
        params: {
            ...data.options,
            out: data.filename
        }
    }));

export const createPngTasks = (exports: ExportChartTypes.PngJobData[]): Task[] => [
    {
        action: 'png',
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
    filenames: ExportChartTypes.Filename<ExportChartTypes.ExportFormat>[]
): Task[] =>
    filenames.map(filename => ({
        action: 'publish',
        params: {
            file: filename,
            teamId: publishOptions.teamId,
            outFile: path.join(publishOptions.outDir, filename)
        }
    }));

export const createExportFileS3Tasks = (
    s3Options: ExportFilesS3Options,
    filenames: ExportChartTypes.Filename<ExportChartTypes.ExportFormat>[]
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
