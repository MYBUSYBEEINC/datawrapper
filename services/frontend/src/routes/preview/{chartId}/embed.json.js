const { getEmbedProps, validateEmbedRequest } = require('../utils.js');

module.exports = {
    name: 'routes/preview/id/embed.json',
    version: '1.0.0',
    register: async server => {
        server.route({
            method: 'GET',
            path: '/embed.json',
            options: {
                validate: validateEmbedRequest
            },
            handler: async (request, h) => {
                return h
                    .response(JSON.stringify(await getEmbedProps(server, request)))
                    .header('Content-Type', 'application/json');
            }
        });
    }
};
