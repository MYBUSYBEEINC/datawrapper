const chartCore = require('@datawrapper/chart-core');

const { getEmbedProps, validateEmbedRequest } = require('../utils.js');

const fs = require('fs').promises;
const path = require('path');

module.exports = {
    name: 'routes/preview/id/embed.js',
    version: '1.0.0',
    register: async server => {
        server.route({
            method: 'GET',
            path: '/embed.js',
            options: {
                validate: validateEmbedRequest
            },
            handler: async (request, h) => {
                const props = await getEmbedProps(server, request);
                const webComponentJS = await fs.readFile(
                    path.join(chartCore.path.dist, 'web-component.js'),
                    'utf-8'
                );
                return h
                    .response(
                        // TODO: find a way to keep sourcemaps working for this
                        webComponentJS + `\n\nwindow.datawrapper.render(${JSON.stringify(props)});`
                    )
                    .header('Content-Type', 'application/javascript');
            }
        });
    }
};
