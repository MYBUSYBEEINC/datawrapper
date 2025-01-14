const Boom = require('@hapi/boom');
const Joi = require('joi');
const get = require('lodash/get');
const injectSafe = require('../../../utils/inject.js');
const set = require('lodash/set');
const uniq = require('lodash/uniq');
const pick = require('lodash/pick');
const {
    AccessToken,
    Action,
    Chart,
    ChartAccessToken,
    ChartPublic,
    ReadonlyChart,
    User,
    UserData
} = require('@datawrapper/orm/db');
const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;
const { createResponseConfig } = require('../../../utils/schemas');
const { getAdditionalMetadata, prepareChart } = require('../../../utils/index.js');
const getEmbedCodes = require('../../../utils/getEmbedCodes');
const { getLocalizationScope } = require('@datawrapper/service-utils');

module.exports = server => {
    // POST /v3/charts/{id}/publish
    server.route({
        method: 'POST',
        path: '/publish',
        options: {
            tags: ['api'],
            description: 'Publish a chart',
            notes: 'Requires scopes `chart:read` *and* `chart:write` *and* `theme:read` *and* `visualization:read`.',
            auth: {
                access: {
                    scope: ['+chart:read', '+chart:write', '+theme:read', '+visualization:read']
                }
            },
            validate: {
                params: Joi.object({
                    id: Joi.string().length(5).required()
                })
            },
            response: createResponseConfig({
                schema: Joi.object({
                    data: Joi.object(),
                    version: Joi.number().integer(),
                    url: Joi.string().uri()
                }).unknown()
            })
        },
        handler: publishChart
    });

    // GET /v3/charts/{id}/publish/data
    server.route({
        method: 'GET',
        path: '/publish/data',
        options: {
            description: 'Get chart data for publication',
            notes: 'Requires scopes `chart:write` *and* `theme:read` *and* `visualization:read`.',
            auth: {
                strategy: 'guest',
                access: {
                    scope: ['+chart:read', '+chart:write', '+theme:read', '+visualization:read']
                }
            },
            validate: {
                params: Joi.object({
                    id: Joi.string().length(5).required()
                })
            }
        },
        handler: publishData
    });

    // GET /v3/charts/{id}/publish/status/{version}
    server.route({
        method: 'GET',
        path: '/publish/status/{version}',
        options: {
            tags: ['api'],
            description: 'Get publish status',
            notes: 'Check the publish status of a chart.  Requires scope `chart:read`.',
            auth: {
                strategy: 'guest',
                access: { scope: ['chart:read'] }
            },
            validate: {
                params: Joi.object({
                    id: Joi.string().length(5).required(),
                    version: Joi.number().integer().min(0)
                })
            },
            response: createResponseConfig({
                schema: Joi.object({
                    progress: Joi.array().items(Joi.string()).empty()
                }).unknown()
            })
        },
        handler: publishChartStatus
    });
};

async function publishChart(request) {
    const { params, auth, headers, server } = request;
    const { events, event, visualizations } = server.app;
    const { createChartWebsite } = server.methods;
    const user = auth.artifacts;
    const chart = await server.methods.loadChart(params.id);

    if (!chart || !(await chart.isPublishableBy(user))) {
        throw Boom.unauthorized();
    }

    const publishStatus = [];
    const publishStatusAction = await server.methods.logAction(
        user.id,
        `chart/${params.id}/publish/${chart.public_version}`,
        ''
    );

    async function logPublishStatus(action) {
        publishStatus.push(action);
        return publishStatusAction.update({
            details: publishStatus.join(',')
        });
    }

    const options = { auth, headers, server, log: logPublishStatus, publish: true };

    // refresh external data
    await server.app.events.emit(server.app.event.CUSTOM_EXTERNAL_DATA, { chart });

    const {
        chartData,
        outDir,
        fileMap,
        cleanup,
        data: publishData
    } = await createChartWebsite(chart, options);

    /**
     * The hard work is done!
     * The only thing left is to move the published chart to it's public directory
     * and update some database entries!
     */

    /* write public CSV file (used when forking a chart) */
    await events.emit(event.PUT_CHART_ASSET, {
        chart,
        // Make sure the data is not null, which would make fs.writeFile() crash.
        data: chartData ?? '',
        filename: `${chart.id}.public.csv`
    });

    /* increment public version */
    const newPublicVersion = chart.public_version + 1;

    /* move assets to publish location */
    let destination;
    let eventFailed = false;

    try {
        destination = await events.emit(
            event.GET_PUBLIC_URL,
            {
                chart,
                newPublicVersion
            },
            { filter: 'first' }
        );
    } catch (error) {
        request.log(['sentry'], error);
        eventFailed = true;
    }

    const publishChartEventResults = await events.emit(event.PUBLISH_CHART, {
        outDir,
        fileMap,
        chart,
        user,
        newPublicVersion,
        log: logPublishStatus
    });
    const publishChartFailedEvents = publishChartEventResults.filter(r => r.status === 'error');
    if (publishChartFailedEvents.length) {
        publishChartFailedEvents.forEach(r => request.log(['sentry'], r.error));
        eventFailed = true;
    }

    /**
     * All files were moved and the temporary directory is not needed anymore.
     */
    await cleanup();

    if (eventFailed) {
        throw Boom.badGateway();
    }

    const now = new Date();

    /* we need to update chart here to get the correct public_url
       in out embed codes */
    await chart.update({
        public_version: newPublicVersion,
        published_at: now,
        public_url: destination,
        last_edit_step: 5
    });

    /* store new embed codes in chart metadata */
    const embedCodes = {};
    const res = await getEmbedCodes({
        chart,
        visualizations,
        user
    });
    res.forEach(embed => {
        embedCodes[`embed-method-${embed.id}`] = embed.code;
    });
    set(chart, 'metadata.publish.embed-codes', embedCodes);

    const chartUpdatePromise = Chart.update(
        {
            metadata: chart.metadata
        },
        { where: { id: chart.id }, limit: 1 }
    );

    /* create or update chart public table row */
    const chartPublicPromise = ChartPublic.upsert({
        id: chart.id,
        title: chart.title,
        type: chart.type,
        metadata: chart.metadata,
        external_data: chart.external_data,
        first_published_at: chart.public_version ? undefined : now,
        author_id: chart.author_id,
        organization_id: chart.organization_id
    });

    await Promise.all([chartUpdatePromise, chartPublicPromise]);

    request.logger.debug({ dest: destination }, `Chart [${chart.id}] published`);

    // log action that chart has been published
    await request.server.methods.logAction(user.id, `chart/publish`, chart.id);

    // log recently published charts
    try {
        const recentlyPublished = JSON.parse(
            await UserData.getUserData(user.id, 'recently_published', '[]')
        );
        if (recentlyPublished[0] !== chart.id) {
            await UserData.setUserData(
                user.id,
                'recently_published',
                JSON.stringify(uniq([chart.id, ...recentlyPublished]).slice(0, 500))
            );
        }
    } catch (err) {
        request.logger.error(`Broken user_data 'recently_published' for user [${user.id}]`);
    }

    // for image publishing and things that we want to (optionally)
    // make the user wait for and/or inform about in publish UI
    await server.app.events.emit(server.app.event.CHART_PUBLISHED, {
        chart,
        user,
        log: logPublishStatus,
        ...pick(publishData, ['themeDataDark', 'themeDataLight'])
    });

    logPublishStatus('done');

    // for webhooks and notifications
    server.app.events.emit(server.app.event.AFTER_CHART_PUBLISHED, {
        chart,
        user
    });

    return {
        data: await prepareChart(chart),
        version: newPublicVersion,
        url: destination
    };
}

async function publishChartStatus(request) {
    const { params, auth, server } = request;

    const chart = await server.methods.loadChart(params.id);
    if (!(await chart.isEditableBy(auth.artifacts, auth.credentials.session))) {
        return Boom.unauthorized();
    }

    const publishAction = await Action.findOne({
        where: {
            key: `chart/${chart.id}/publish/${params.version}`
        },
        order: [['id', 'DESC']]
    });

    if (!publishAction) throw Boom.notFound();

    return {
        progress: publishAction.details ? publishAction.details.split(',') : []
    };
}

async function publishData(request) {
    const { query, params, server, auth, headers } = request;
    const { events, event, visualizations } = server.app;

    const chart = await Chart.findOne({
        where: { id: params.id, deleted: { [Op.not]: true } },
        attributes: { exclude: ['deleted', 'deleted_at', 'utf8'] }
    });

    if (!chart) throw Boom.notFound();

    let user = auth.artifacts;

    let readonlyChart;
    if (query.published) {
        const publicChart = await ChartPublic.findByPk(chart.id);
        if (!publicChart) {
            throw Boom.notFound();
        }
        readonlyChart = await ReadonlyChart.fromPublicChart(chart, publicChart);
    } else {
        const isEditable = await chart.isEditableBy(auth.artifacts, auth.credentials.session);
        if (!isEditable) {
            if (query.chartExportToken) {
                const chartIdFromToken = await AccessToken.getExportedChartId(
                    query.chartExportToken
                );
                if (chartIdFromToken !== params.id) {
                    throw Boom.unauthorized();
                }
            } else if (query.ott) {
                const count = await ChartAccessToken.count({
                    where: {
                        chart_id: params.id,
                        token: query.ott
                    },
                    limit: 1
                });
                if (!count) {
                    throw Boom.unauthorized();
                }
            } else {
                throw Boom.unauthorized();
            }

            if (chart.author_id) {
                user = await User.findByPk(chart.author_id);
            }
        }
        readonlyChart = await ReadonlyChart.fromChart(chart);
    }

    // the csv dataset
    const res = await injectSafe(request, {
        url: `/v3/charts/${params.id}/data${
            query.published
                ? '?published=1'
                : query.chartExportToken
                ? `?chartExportToken=${query.chartExportToken}`
                : query.ott
                ? `?ott=${query.ott}`
                : ''
        }`,
        auth,
        headers
    });

    const additionalData = await getAdditionalMetadata(readonlyChart, { server });

    const data = { chart: await prepareChart(readonlyChart, additionalData) };

    // the vis
    const visProperties = [
        'id',
        'ariaLabel',
        'script',
        'axes',
        'dependencies',
        'height',
        'libraries',
        'namespace',
        'supportsFitHeight',
        'title',
        '__plugin'
    ];
    data.visualization = pick(server.app.visualizations.get(chart.type), visProperties);
    if (!data.visualization.id) {
        return Boom.badRequest('Invalid chart type');
    }
    const themeId = query.theme || chart.theme;

    data.chart.theme = themeId;

    // the theme
    const themeRes = await request.server.inject({
        url: `/v3/themes/${themeId}?extend=true`,
        auth,
        headers
    });

    if (themeRes.result.statusCode === 404) {
        return Boom.badRequest("Chart theme doesn't exist");
    }

    if (themeRes.result.statusCode === 403) {
        return Boom.unauthorized('Scope theme:read required');
    }

    data.theme = themeRes.result;

    // the styles
    const styleRes = await request.server.inject({
        url: `/v3/visualizations/${
            data.visualization.id
        }/styles.css?theme=${themeId}&transparent=${!!query.transparent}`,
        auth,
        headers
    });
    data.styles = styleRes.result;

    const htmlBodyResults = await events.emit(
        event.CHART_AFTER_BODY_HTML,
        {
            chart: readonlyChart,
            data,
            publish: query.publish === 'true'
        },
        { filter: 'success' }
    );
    data.chartAfterBodyHTML = htmlBodyResults.join('\n');

    const htmlHeadResults = await events.emit(
        event.CHART_AFTER_HEAD_HTML,
        {
            chart: readonlyChart,
            data,
            publish: query.publish === 'true'
        },
        { filter: 'success' }
    );
    data.chartAfterHeadHTML = htmlHeadResults.join('\n');

    // chart translations
    data.translations = getLocalizationScope('chart', chart.language || 'en-US');

    data.assets = [
        {
            name: `dataset.${get(chart, 'metadata.data.json') ? 'json' : 'csv'}`,
            value: res.result,
            shared: false
        },
        ...(
            await server.app.events.emit(
                server.app.event.CHART_ASSETS,
                {
                    chart,
                    auth,
                    chartExportToken: query.chartExportToken,
                    ott: query.ott
                },
                { filter: 'success' }
            )
        ).filter(el => typeof el === 'object')
    ];

    data.externalDataUrl = await events.emit(event.EXTERNAL_DATA_URL, null, {
        filter: 'first'
    });

    if (query.ott) {
        await ChartAccessToken.destroy({
            where: {
                chart_id: params.id,
                token: query.ott
            },
            limit: 1
        });
    }

    const chartBlocks = await events.emit(
        event.CHART_BLOCKS,
        {
            chart: readonlyChart,
            user,
            data
        },
        { filter: 'success' }
    );
    data.blocks = chartBlocks.filter(d => d);

    if (query.publish === 'true') {
        /* when publishing, we set the embed codes in the metadata now already,
         * so that the chart footer embed links are up to date */
        const publicUrl = await events.emit(
            event.GET_NEXT_PUBLIC_URL,
            { chart: readonlyChart },
            { filter: 'first' }
        );

        if (publicUrl) {
            const embedCodes = {};
            const res = await getEmbedCodes({
                chart: readonlyChart,
                visualizations,
                user,
                publicUrl,
                publicVersion: chart.public_version + 1
            });
            res.forEach(embed => {
                embedCodes[`embed-method-${embed.id}`] = embed.code;
            });
            set(data.chart, 'metadata.publish.embed-codes', embedCodes);
            set(data.chart, 'publicUrl', publicUrl);
            set(data.chart, 'publicVersion', chart.public_version + 1);
            data.nextPublicUrl = publicUrl;
        }
    }

    return data;
}
