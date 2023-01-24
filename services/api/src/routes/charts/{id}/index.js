const Joi = require('joi');
const Boom = require('@hapi/boom');
const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;
const {
    Chart,
    ChartPublic,
    Folder,
    ReadonlyChart,
    User,
    UserData,
    withTransaction
} = require('@datawrapper/orm/db');
const uniq = require('lodash/uniq');
const set = require('lodash/set');
const get = require('lodash/get');
const isEqual = require('lodash/isEqual');
const cloneDeep = require('lodash/cloneDeep');
const assignWithEmptyObjects = require('../../../utils/assignWithEmptyObjects');
const { camelizeKeys, decamelizeKeys } = require('humps');
const {
    getAdditionalMetadata,
    isValidMySQLJSON,
    prepareChart,
    getNewChartAuthor
} = require('../../../utils/index.js');
const { noContentResponse, chartResponse } = require('../../../utils/schemas');

module.exports = {
    name: 'routes/charts/{id}',
    version: '1.0.0',
    register(server, options) {
        // GET /v3/charts/{id}
        server.route({
            method: 'GET',
            path: '/',
            options: {
                tags: ['api'],
                description: 'Fetch chart metadata',
                notes: `Requires scope \`chart:read\` or \`chart:write\`.`,
                auth: {
                    strategy: 'guest',
                    access: { scope: ['chart:read', 'chart:write'] }
                },
                validate: {
                    params: Joi.object({
                        id: Joi.string()
                            .length(5)
                            .required()
                            .description('5 character long chart ID.')
                    }),
                    query: Joi.object({
                        published: Joi.boolean()
                    }).unknown(true)
                },
                response: chartResponse
            },
            handler: getChart
        });

        // DELETE /v3/charts/{id}
        server.route({
            method: 'DELETE',
            path: '/',
            options: {
                tags: ['api'],
                description: 'Delete a chart',
                notes: `This action is permanent. Be careful when using this endpoint.
                        If this endpoint should be used in an application (CMS), it is recommended to
                        ask the user for confirmation.  Requires scope \`chart:write\`.`,
                auth: {
                    access: { scope: ['chart:write'] }
                },
                validate: {
                    params: Joi.object({
                        id: Joi.string()
                            .length(5)
                            .required()
                            .description('5 character long chart ID.')
                    })
                },
                response: noContentResponse
            },
            handler: deleteChart
        });

        const editChartPayload = Joi.object({
            title: Joi.string()
                .example('My cool chart')
                .allow('')
                .description('Title of your chart. This will be the chart headline.'),
            theme: Joi.string().example('datawrapper').description('Chart theme to use.'),
            type: Joi.string()
                .example('d3-lines')
                .description(
                    'Type of the chart ([Reference](https://developer.datawrapper.de/v3.0/docs/chart-types))'
                ),
            lastEditStep: Joi.number()
                .integer()
                .example(1)
                .description('Used in the app to determine where the user last edited the chart.'),
            folderId: Joi.number().allow(null).optional(),
            organizationId: Joi.string().allow(null).optional(),
            metadata: Joi.object({
                data: Joi.object({
                    transpose: Joi.boolean()
                }).unknown(true)
            })
                .description('Metadata that saves all chart specific settings and options.')
                .unknown(true)
                .custom(v => {
                    if (!isValidMySQLJSON(v)) {
                        throw new Error('Invalid JSON');
                    }
                    return v;
                })
        }).unknown();

        // PATCH /v3/charts/{id}
        server.route({
            method: 'PATCH',
            path: '/',
            options: {
                tags: ['api'],
                description: 'Update specific chart properties.',
                notes: 'Allows for partial metadata updates (via JSON merge patch). Requires scope `chart:write`.',
                auth: {
                    strategy: 'guest',
                    access: { scope: ['chart:write'] }
                },
                validate: {
                    params: Joi.object({
                        id: Joi.string()
                            .length(5)
                            .required()
                            .description('5 character long chart ID.')
                    }),
                    payload: editChartPayload
                },
                response: chartResponse
            },
            handler: editChart
        });

        // PUT /v3/charts/{id}
        server.route({
            method: 'PUT',
            path: '/',
            options: {
                tags: ['api'],
                description: 'Update all chart properties',
                notes: 'Replaces the entire metadata object. Requires scope `chart:write`.',
                auth: {
                    strategy: 'guest',
                    access: { scope: ['chart:write'] }
                },
                validate: {
                    params: Joi.object({
                        id: Joi.string()
                            .length(5)
                            .required()
                            .description('5 character long chart ID.')
                    }),
                    payload: editChartPayload
                },
                response: chartResponse
            },
            handler: editChart
        });

        require('./assets')(server, options);
        require('./data')(server, options);
        require('./embed-codes')(server, options);
        require('./export')(server, options);
        require('./publish')(server, options);
        require('./unpublish')(server, options);
        require('./copy')(server, options);
        require('./fork')(server, options);
    }
};

async function getChart(request) {
    const { url, query, params, auth, server } = request;

    const options = {
        attributes: [
            'guest_session',
            'author_id',
            'created_at',
            'createdAt',
            'external_data',
            'forkable',
            'forked_from',
            'id',
            'in_folder',
            'is_fork',
            'language',
            'last_edit_step',
            'last_modified_at',
            'metadata',
            'organization_id',
            'public_url',
            'public_version',
            'published_at',
            'theme',
            'title',
            'type'
        ],
        where: {
            id: params.id,
            deleted: { [Op.not]: true }
        }
    };

    set(options, ['include'], [{ model: User, attributes: ['name', 'email'] }]);

    await server.app.events.emit(server.app.event.EXTEND_LIST_CHART_OPTIONS, {
        options,
        request
    });

    const chart = await Chart.findOne(options);

    if (!chart) {
        return Boom.notFound();
    }

    const isEditable = await chart.isEditableBy(auth.artifacts, auth.credentials.session);

    let readonlyChart;
    if (query.published || !isEditable) {
        if (!isEditable) delete chart.dataValues.user;
        if (chart.published_at) {
            const publicChart = await ChartPublic.findByPk(chart.id);
            if (!publicChart) {
                throw Boom.notFound();
            }
            readonlyChart = await ReadonlyChart.fromPublicChart(chart, publicChart);
        } else {
            return Boom.unauthorized();
        }
    } else {
        readonlyChart = await ReadonlyChart.fromChart(chart);
    }

    const additionalData = await getAdditionalMetadata(readonlyChart, { server });

    if (server.methods.config('general').imageDomain) {
        additionalData.thumbnails = {
            full: `//${server.methods.config('general').imageDomain}/${
                readonlyChart.id
            }/${readonlyChart.getThumbnailHash()}/full.png`,
            plain: `//${server.methods.config('general').imageDomain}/${
                readonlyChart.id
            }/${readonlyChart.getThumbnailHash()}/plain.png`
        };
    }

    return {
        ...(await prepareChart(readonlyChart, additionalData)),
        url: `${url.pathname}`
    };
}

async function editChart(request) {
    const { params, payload, auth, url, server } = request;
    const { metadata, ...payloadWithoutMetadata } = payload;
    const camelizedPayload = {
        ...camelizeKeys(payloadWithoutMetadata),
        ...(metadata && { metadata }) // make sure the 'metadata' value is not undefined
    };
    const user = auth.artifacts;
    const isAdmin = server.methods.isAdmin(request);

    if (camelizedPayload && camelizedPayload.type) {
        // validate chart type
        if (!server.app.visualizations.has(camelizedPayload.type)) {
            return Boom.badRequest('Invalid chart type');
        }
    }

    // @todo: deprecate inFolder payload in favor of folderId
    const payloadFolder = get(camelizedPayload, 'folderId', camelizedPayload.inFolder);
    if (payloadFolder) {
        camelizedPayload.inFolder = payloadFolder;
        delete camelizedPayload.folderId;
    }

    const chart = await Chart.findOne({
        where: {
            id: params.id,
            deleted: { [Op.not]: true }
        }
    });

    if (!chart) {
        return Boom.notFound();
    }

    const isEditable = await chart.isEditableBy(auth.artifacts, auth.credentials.session);

    if (!isEditable) {
        return Boom.unauthorized();
    }

    if (camelizedPayload.inFolder) {
        // check if folder belongs to user or team
        const folder = await Folder.findByPk(camelizedPayload.inFolder);

        if (
            !folder ||
            (!isAdmin &&
                folder.user_id !== auth.artifacts.id &&
                !(await user.hasActivatedTeam(folder.org_id)))
        ) {
            throw Boom.unauthorized(
                'User does not have access to the specified folder, or it does not exist.'
            );
        }
        // @todo: if payload contains both folder & organization, reject if they are mismatched,
        // instead of simply ignoring payload organizationId
        camelizedPayload.organizationId = folder.org_id;
    } else if ('organizationId' in camelizedPayload) {
        if (camelizedPayload.organizationId !== chart.organization_id && chart.in_folder) {
            camelizedPayload.inFolder = null;
        }
    }

    if ('isFork' in camelizedPayload && !isAdmin) {
        delete camelizedPayload.isFork;
    }

    if ('authorId' in camelizedPayload && !isAdmin) {
        delete camelizedPayload.authorId;
    }

    let newAuthor;
    if (camelizedPayload.authorId) {
        newAuthor = await User.findByPk(camelizedPayload.authorId);
        if (!newAuthor) return Boom.badRequest('Specified user does not exist');

        const newAuthorTeams = (await newAuthor.getTeams()).map(t => t.id);
        const chartTeam = get(camelizedPayload, 'organizationId', chart.organization_id);

        if (chartTeam && !newAuthorTeams.includes(chartTeam)) {
            return Boom.badRequest(`Specified user may not access team`);
        }
    }

    if (camelizedPayload.organizationId) {
        // user does not have access to team
        if (!isAdmin && !(await user.hasActivatedTeam(camelizedPayload.organizationId))) {
            return Boom.unauthorized('User does not have access to the specified team.');
        }
        // check if chart author has access to new team
        // (in case admin set new author, and there was a conflict, the request would have already returned 400)
        if (!newAuthor) {
            const chartAuthorUser = await User.findByPk(chart.author_id);
            const chartAuthorTeamIds = (await chartAuthorUser.getTeams()).map(t => t.id);
            // chart author does not have access to new team
            if (!chartAuthorTeamIds.includes(camelizedPayload.organizationId)) {
                const newAuthorId = await getNewChartAuthor(user, camelizedPayload.organizationId);
                camelizedPayload.authorId = newAuthorId;
            }
        }
    }

    // prevent information about earlier publish from being reverted
    if (
        !isNaN(camelizedPayload.publicVersion) &&
        camelizedPayload.publicVersion < chart.public_version
    ) {
        camelizedPayload.publicVersion = chart.public_version;
        camelizedPayload.publicUrl = chart.public_url;
        camelizedPayload.publishedAt = chart.published_at;
        camelizedPayload.lastEditStep = chart.last_edit_step;
        set(
            camelizedPayload,
            'metadata.publish.embed-codes',
            get(chart, 'metadata.publish.embed-codes', {})
        );
    }

    const oldData = await prepareChart(chart);
    const newData = { ...oldData, ...camelizedPayload };

    if (request.method === 'patch' && camelizedPayload.metadata) {
        newData.metadata = assignWithEmptyObjects(
            cloneDeep(oldData.metadata),
            camelizedPayload.metadata
        );
    }

    // check if we have actually changed something
    const chartOld = cloneDeep(chart.dataValues);
    const chartNew = decamelizeKeys(newData);

    const ignoreKeys = new Set([
        'guest_session',
        'public_id',
        'created_at',
        'last_modified_at',
        'author',
        'folder_id'
    ]);

    const hasChanged = Object.keys(chartNew).find(
        key =>
            !ignoreKeys.has(key) &&
            !isEqual(chartNew[key], chartOld[key]) &&
            (chartNew[key] || chartOld[key])
    );

    if (hasChanged) {
        // only update and log edit if something has changed
        await Chart.update(
            {
                ...decamelizeKeys(newData),
                metadata: newData.metadata
            },
            {
                where: { id: chart.id },
                limit: 1
            }
        );

        // log chart/edit
        await request.server.methods.logAction(user.id, `chart/edit`, chart.id);

        if (user.role !== 'guest') {
            // update recently edited charts
            await withTransaction(async t => {
                const recentlyEditedStr = await UserData.getUserData(
                    user.id,
                    'recently_edited',
                    '[]',
                    {
                        transaction: t
                    }
                );
                let recentlyEdited;
                try {
                    recentlyEdited = JSON.parse(recentlyEditedStr);
                } catch (e) {
                    // Do nothing.
                }
                if (!Array.isArray(recentlyEdited)) {
                    request.logger.warn(
                        `Broken user_data 'recently_edited' for user ${user.id}, resetting it`
                    );
                    recentlyEdited = [];
                }
                if (recentlyEdited[0] !== chart.id) {
                    await UserData.setUserData(
                        user.id,
                        'recently_edited',
                        JSON.stringify(uniq([chart.id, ...recentlyEdited]).slice(0, 500)),
                        {
                            transaction: t
                        }
                    );
                }
            });
        }
        await chart.reload();
    }
    return {
        ...(await prepareChart(chart)),
        url: `${url.pathname}`
    };
}

async function deleteChart(request, h) {
    const { auth, server, params } = request;
    const options = {
        where: {
            id: params.id,
            deleted: {
                [Op.not]: true
            }
        }
    };

    const chart = await Chart.findOne(options);

    if (!chart) return Boom.notFound();

    if (
        !server.methods.isAdmin(request) &&
        !(await chart.isEditableBy(auth.artifacts, auth.credentials.session))
    ) {
        return Boom.forbidden();
    }

    await chart.update({
        deleted: true,
        deleted_at: new Date()
    });

    await server.app.events.emit(server.app.event.CHART_DELETED, {
        chart,
        user: auth.artifacts
    });

    return h.response().code(204);
}
