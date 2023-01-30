const Boom = require('@hapi/boom');

module.exports = {
    name: 'api-v1/themes',
    register: async server => {
        server.route({
            method: 'GET',
            path: '/',
            options: {
                auth: {
                    mode: 'required'
                }
            },
            async handler(request) {
                const isAdmin = server.methods.isAdmin(request);

                let offset = 0;
                const data = [];

                try {
                    let res = await fetchThemes(offset);

                    if (!res.result.error) {
                        data.push(...res.result.list);

                        while (data.length < res.result.total) {
                            offset += res.result.list.length;
                            res = await fetchThemes(offset);
                            data.push(...res.result.list);
                        }

                        return { status: 'ok', data };
                    }

                    if (res.result.message === 'Insufficient scope') {
                        return boomErrorWithData(Boom.forbidden('Insufficient scope'), {
                            code: 'access-denied'
                        });
                    }
                    // wrap generic errors
                    return boomErrorWithData(
                        new Boom.Boom(res.result.message, {
                            statusCode: res.result.statusCode
                        }),
                        res.result
                    );
                } catch (ex) {
                    server.logger.warn(ex);
                    return boomErrorWithData(Boom.badGateway('unexpected error'), {
                        code: 'unknown_error',
                        message: 'Unknown error'
                    });
                }

                function fetchThemes(offset = 0) {
                    const url = `${isAdmin ? '/v3/admin/themes' : '/v3/themes'}?offset=${offset}`;
                    return request.server.inject({
                        method: 'GET',
                        url,
                        auth: request.auth,
                        headers: request.headers
                    });
                }
            }
        });
    }
};

function boomErrorWithData(boom, data) {
    boom.output.payload = {
        ...boom.output.payload,
        status: 'error',
        ...data
    };
    return boom;
}
