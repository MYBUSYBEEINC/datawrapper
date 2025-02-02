"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExportFileS3Tasks = exports.createExportFilePublishTasks = exports.createPngTasks = exports.createSvgTasks = exports.createPdfTasks = exports.createCloudflareInvalidateTask = void 0;
const node_path_1 = __importDefault(require("node:path"));
const createCloudflareInvalidateTask = (urls) => ({
    action: 'cloudflare',
    params: {
        urls
    }
});
exports.createCloudflareInvalidateTask = createCloudflareInvalidateTask;
const createPdfTasks = (exports) => exports.map(data => {
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
exports.createPdfTasks = createPdfTasks;
const createSvgTasks = (exports) => exports.map(data => ({
    action: 'svg',
    params: {
        ...data.options,
        out: data.filename
    }
}));
exports.createSvgTasks = createSvgTasks;
const createPngTasks = (exports) => [
    {
        action: 'png',
        params: {
            sizes: exports.map(data => ({
                ...data.options,
                out: data.filename
            })) ?? []
        }
    },
    ...exports.flatMap(data => {
        const subTasks = [];
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
exports.createPngTasks = createPngTasks;
const createExportFilePublishTasks = (publishOptions, filenames) => filenames.map(filename => ({
    action: 'publish',
    params: {
        file: filename,
        teamId: publishOptions.teamId,
        outFile: node_path_1.default.join(publishOptions.outDir, filename)
    }
}));
exports.createExportFilePublishTasks = createExportFilePublishTasks;
const createExportFileS3Tasks = (s3Options, filenames) => filenames.map(filename => ({
    action: 's3',
    params: {
        acl: s3Options.acl,
        bucket: s3Options.bucket,
        file: filename,
        path: `${s3Options.dirPath}/${filename}`
    }
}));
exports.createExportFileS3Tasks = createExportFileS3Tasks;
