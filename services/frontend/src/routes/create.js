const Joi = require('joi');
const Boom = require('@hapi/boom');
const get = require('lodash/get');
const set = require('lodash/set');
const { createChart } = require('@datawrapper/service-utils');
const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;
const { Chart, ChartPublic, Team } = require('@datawrapper/orm/db');

module.exports = {
    name: 'routes/create',
    version: '1.0.0',
    async register(server) {
        server.route({
            path: '/',
            method: 'GET',
            options: {
                auth: 'guest'
            },
            async handler(request, h) {
                return h.redirect('/create/chart');
            }
        });

        server.route({
            path: '/{workflow}',
            method: 'GET',
            options: {
                auth: 'guest',
                validate: {
                    params: Joi.object({
                        workflow: Joi.string().valid('chart', 'map', 'table', 'locator-map')
                    }),
                    query: Joi.object({
                        type: Joi.string().optional(),
                        team: Joi.string().optional(),
                        folder: Joi.number().integer().min(1).optional(),
                        v: Joi.number().optional() // legacy cache-busting
                    })
                }
            },
            async handler(request, h) {
                const cfg = server.methods.config('general');
                const { auth, params, query } = request;
                const { workflow } = params;
                const { type } = query;
                const payload = {};
                if (query.folder) payload.folderId = query.folder;
                if (query.team) payload.teamId = query.team;
                if (type) {
                    // check if chart type exists
                    if (!server.app.visualizations.has(type)) {
                        return Boom.badRequest('Invalid visualization type');
                    }
                    const vis = server.app.visualizations.get(type);
                    if (vis.namespace && vis.namespace !== workflow) {
                        return Boom.badRequest(
                            `Type ${type} does not belong to namespace ${workflow}`
                        );
                    }
                    payload.type = type;
                } else {
                    // get default type from namespace
                    if (workflow === 'map') {
                        const params = new URLSearchParams({
                            ...(query.folder ? { folder: query.folder } : null),
                            ...(query.team ? { team: query.team } : null)
                        }).toString();
                        // use old map selector for now (it will redirect us back here)
                        return h.redirect(`/select/map${params ? `?${params}` : ''}`);
                    } else if (workflow === 'table') {
                        payload.type = 'tables';
                    } else if (workflow === 'locator-map') {
                        payload.type = 'locator-map';
                    } else {
                        payload.type = get(cfg, 'defaults.type', 'd3-bars');
                    }
                }
                // create new chart
                const user = auth.artifacts;
                const { session } = auth.credentials;

                if (type === 'locator-map') {
                    // Locator maps always work with json data.
                    // This flag needs to be set to make sure the dataset is parsed correctly.
                    set(payload, 'metadata.data.json', true);
                }

                try {
                    const chart = await createChart({ server, payload, user, session });

                    if (type === 'locator-map') {
                        // Locator maps always need valid default data that can be parsed.
                        // If this is not set the map preview won't render for some reason.
                        const api = server.methods.createAPI(request);
                        await api(`/charts/${chart.id}/data`, {
                            method: 'put',
                            body: `{ "markers": [] }`
                        });
                    }

                    return h.redirect(
                        type === 'locator-map' ? `/edit/${chart.id}` : `/chart/${chart.id}/edit`
                    );
                } catch (e) {
                    if (Boom.isBoom(e)) return e;
                    server.logger.error(e);
                    return Boom.badRequest();
                }
            }
        });

        const additionalFields = {
            description: 'metadata.describe.intro',
            aria_description: 'metadata.describe.aria-description',
            source_name: 'metadata.describe.source-name',
            source_url: 'metadata.describe.source-url',
            notes: 'metadata.annotate.notes',
            byline: 'metadata.describe.byline'
        };

        server.route({
            path: '/',
            method: 'POST',
            options: {
                auth: 'guest',
                validate: {
                    payload: Joi.alternatives().try(
                        Joi.object({
                            title: Joi.string().optional().allow(''),
                            description: Joi.string().optional().allow(''),
                            aria_description: Joi.string().optional().allow(''),
                            type: Joi.string().optional(),
                            theme: Joi.string().optional(),
                            source_name: Joi.string().optional().allow(''),
                            source_url: Joi.string().optional().allow(''),
                            notes: Joi.string().optional().allow(''),
                            byline: Joi.string().optional().allow(''),
                            language: Joi.string()
                                .pattern(/[a-z][a-z](-[A-Z][A-Z])?/)
                                .optional()
                                .default('en-US'),
                            metadata: Joi.string().optional().allow(''),
                            last_edit_step: Joi.number()
                                .integer()
                                .min(2)
                                .max(4)
                                .optional()
                                .default(3),
                            data: Joi.string().optional().allow(''),
                            external_data: Joi.string().optional().allow('')
                        }),
                        Joi.object({
                            template: Joi.string()
                                .optional()
                                .regex(/[a-zA-Z0-9]{5}/)
                        })
                    )
                }
            },
            async handler(request, h) {
                const { payload } = request;
                if (!payload) throw Boom.badRequest('you need to send form-encoded data');
                if (payload.template) {
                    // create new chart from existing chart (template)
                    const api = server.methods.createAPI(request);

                    const chartPublic = await ChartPublic.findByPk(payload.template);
                    // check if chart has been published
                    if (!chartPublic) throw Boom.notFound();
                    // check if original chart has not been deleted
                    const chart = await Chart.findOne({
                        where: {
                            id: payload.template,
                            deleted: { [Op.not]: true }
                        }
                    });
                    if (!chart) throw Boom.notFound();

                    const team = await Team.findByPk(chart.organization_id);

                    if (team && team.settings.chartTemplates) {
                        // team supports one-click "edit this chart"
                        const newChart = await api(`/charts/${chart.id}/copy`, { method: 'post' });

                        return h.redirect(
                            newChart.type === 'locator-map'
                                ? `/edit/${newChart.id}`
                                : `/chart/${newChart.id}/edit`
                        );
                    } else {
                        // if settings.chartTemplates is false charts need to be
                        // made forkable in order to be used as templates
                        if (!chart.forkable) {
                            throw Boom.notFound('visualization not found');
                        }
                        // ask user to confirm the forking
                        const props = { template: chart };
                        return h.view('Create.svelte', { props });
                    }
                } else {
                    // create new chart from payload metadata
                    if (!payload.data && !payload.external_data) {
                        throw Boom.badRequest(
                            'you need to provide either data or an external_data url'
                        );
                    }
                    let metadata = {};
                    if (payload.metadata) {
                        try {
                            metadata = JSON.parse(payload.metadata);
                        } catch (e) {
                            throw Boom.badRequest('Invalid chart metadata JSON');
                        }
                    }
                    const chartData = {
                        title: payload.title,
                        theme: payload.theme || 'datawrapper-data',
                        type: payload.type,
                        language: payload.language,
                        external_data: payload.external_data,
                        last_edit_step: payload.last_edit_step || 3,
                        metadata
                    };
                    Object.keys(additionalFields).forEach(key => {
                        if (payload[key]) {
                            set(chartData, additionalFields[key], payload[key]);
                        }
                    });
                    if (payload.external_data) {
                        set(chartData, 'metadata.data.upload-method', 'external-data');
                        set(chartData, 'metadata.data.external-data', payload.external_data);
                        set(chartData, 'metadata.data.use-datawrapper-cdn', false);
                    }
                    const dataset = payload.data || '';
                    const props = { chartData, dataset };
                    return h.view('Create.svelte', { props });
                }
            }
        });
    }
};
