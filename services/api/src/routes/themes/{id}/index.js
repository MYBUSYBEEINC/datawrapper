const Joi = require('joi');
const Boom = require('@hapi/boom');
const assign = require('assign-deep');
const { compileFontCSS } = require('@datawrapper/chart-core/lib/styles/compile-css.js');
const {
    getBackgroundColors,
    convertToDarkMode
} = require('@datawrapper/chart-core/dist/darkMode.cjs.js');

const { Theme, User, Team, Chart } = require('@datawrapper/orm/db');
const { get, set, cloneDeep } = require('lodash');
const {
    dropCache,
    getCaches,
    getThemeCacheKey,
    themeId,
    validateThemeData,
    validateThemeLess
} = require('../../../utils/themes');

module.exports = {
    name: 'routes/themes/{id}',
    version: '1.0.0',
    register: server => {
        const config = server.methods.config();
        const defaultTheme = get(config, 'general.defaults.theme', 'default');
        const { styleCache, themeCache } = getCaches(server);

        // GET /v3/themes/{id}
        server.route({
            method: 'GET',
            path: '/',
            options: {
                auth: {
                    mode: 'try',
                    access: { scope: ['theme:read'] }
                },
                validate: {
                    params: Joi.object({
                        id: themeId().required()
                    }),
                    query: Joi.object({
                        extend: Joi.boolean().default(false),
                        dark: Joi.boolean().default(false)
                    })
                }
            },
            handler: getTheme
        });

        // update theme PATCH /v3/themes/{id}
        server.route({
            path: '/',
            method: 'PATCH',
            options: {
                auth: 'admin',
                validate: {
                    params: Joi.object({
                        id: themeId().required()
                    }),
                    payload: Joi.object({
                        title: Joi.string(),
                        extend: themeId(),
                        data: Joi.object(),
                        assets: Joi.object(),
                        less: Joi.string().allow('')
                    })
                }
            },
            async handler(request) {
                const { params, payload } = request;
                const theme = await Theme.findByPk(params.id);
                if (!theme) return Boom.notFound();

                const data = {};

                // copy white-listed attributes from payload
                ['title', 'extend', 'data', 'assets', 'less'].forEach(key => {
                    if (payload[key] !== undefined) data[key] = payload[key];
                });

                if (data.less) await validateThemeLess(data.less, server, theme.id);
                if (data.data) await validateThemeData(data.data, server);

                // save colors.groups as flat array to colors.palette
                if (data.data?.colors?.groups) {
                    data.data.colors.palette = data.data.colors.groups.reduce((acc, group) => {
                        if (!group.colors) return acc;
                        group.colors.forEach(subgroup => {
                            acc.push(...subgroup);
                        });
                        return acc;
                    }, []);
                }

                await theme.update(data);

                await dropCache({
                    theme,
                    themeCache,
                    styleCache,
                    visualizations: server.app.visualizations
                });

                return theme.toJSON();
            }
        });

        // delete theme
        server.route({
            path: '/',
            method: 'DELETE',
            options: {
                auth: 'admin',
                validate: {
                    params: Joi.object({
                        id: themeId().required()
                    }),
                    query: Joi.object({
                        newChartTheme: themeId()
                    })
                }
            },
            async handler(request, h) {
                const { params, query } = request;
                const theme = await Theme.findByPk(params.id, {
                    include: [User, Team]
                });

                if (!theme) return Boom.notFound();
                let newChartTheme = defaultTheme;

                if (query.newChartTheme) {
                    const newTheme = await Theme.findByPk(query.newChartTheme);
                    if (!newTheme) return Boom.notFound();
                    newChartTheme = newTheme.id;
                }

                // remove associations
                const removedForUsers = await theme.setUsers([]);
                const removedForTeams = await theme.setTeams([]);
                const updatedCharts = await Chart.update(
                    { theme: newChartTheme },
                    {
                        where: {
                            theme: theme.id
                        }
                    }
                );
                const updatedTeamDefaultTheme = await Team.update(
                    { default_theme: defaultTheme },
                    {
                        where: {
                            default_theme: theme.id
                        }
                    }
                );
                await theme.destroy();

                await dropCache({
                    theme,
                    themeCache,
                    styleCache,
                    visualizations: server.app.visualizations
                });
                return h
                    .response({
                        removedForTeams: removedForTeams[0] || 0,
                        removedForUsers: removedForUsers[0] || 0,
                        updatedCharts: updatedCharts[0],
                        updatedTeamDefaultTheme: updatedTeamDefaultTheme[0]
                    })
                    .code(200);
            }
        });

        require('./asset')(server);
        require('./font')(server);
        require('./users')(server);
        require('./teams')(server);

        async function getTheme(request) {
            const { server, params, query, url } = request;
            const themeCacheKey = getThemeCacheKey(params.id, {
                dark: query.dark,
                extend: query.extend
            });
            if (themeCache) {
                const cachedTheme = await themeCache.get(themeCacheKey);
                if (cachedTheme) return cachedTheme;
            }

            let originalExtend;
            let dataValues = { extend: params.id, data: {} };
            let overrides = [];

            while (dataValues.extend) {
                const extendedTheme = await Theme.findByPk(dataValues.extend);

                if (!extendedTheme) return Boom.notFound();

                if (get(extendedTheme.data, 'overrides')) {
                    overrides = [...get(extendedTheme.data, 'overrides'), ...overrides];
                }

                if (!originalExtend) {
                    originalExtend = extendedTheme.extend;
                }

                if (!dataValues.id) {
                    dataValues = {
                        ...extendedTheme.dataValues,
                        assets: extendedTheme.assets,
                        data: extendedTheme.data
                    };
                }

                if (extendedTheme.less !== dataValues.less) {
                    dataValues.less = [extendedTheme.less || '', dataValues.less || ''].join('\n');
                }

                dataValues.data = assign(extendedTheme.data, dataValues.data);
                dataValues.assets = { ...extendedTheme.assets, ...dataValues.assets };
                dataValues.extend = extendedTheme.extend;

                if (!query.extend) break;
            }

            dataValues.extend = originalExtend;
            dataValues.url = url.pathname;
            if (overrides.length) {
                dataValues.data.overrides = overrides;
            }

            if (server.methods.isAdmin(request)) {
                try {
                    await server.methods.getSchemas().validateThemeData(dataValues.data);
                    dataValues.errors = [];
                } catch (err) {
                    if (err.name === 'ValidationError') {
                        dataValues.errors = err.details;
                    } else {
                        throw err;
                    }
                }
            }

            const { created_at, ...theme } = dataValues;

            const { darkBg, origBg, origBgLum: bgColorLum } = getBackgroundColors(theme);
            const origGradients = get(theme, 'data.colors.gradients', []);

            await server.app.events.emit(server.app.event.COMPUTED_THEME_DATA, { theme });

            setOrigAnnotations(theme);

            const themeSchema = await server.methods.getSchemas().getSchemaJSON('themeData');

            if (bgColorLum >= 0.3) {
                if (query.dark) {
                    await convertToDarkMode(themeSchema, { theme, darkBg, origBg });
                }
            } else {
                // this theme is dark already, prevent dark mode preview
                set(
                    theme,
                    'data.options.darkMode.preview',
                    get(theme, 'data.options.darkMode.preview', false)
                );
            }
            set(theme, '_computed.bgLight', origBg);
            set(theme, '_computed.bgDark', darkBg);
            set(theme, '_computed.origGradients', origGradients);

            const fonts = getThemeFonts(theme);
            const fontsCSS = await compileFontCSS(fonts, theme.data);
            const result = { ...theme, fonts, createdAt: created_at, fontsCSS };
            if (themeCache) {
                themeCache.set(themeCacheKey, result);
            }
            return result;
        }
    }
};

function setOrigAnnotations(theme) {
    ['line', 'range'].forEach(type => {
        const settings = cloneDeep(get(theme.data, `style.chart.${type}Annotations`, {}));
        set(theme, `_computed.original.${type}Annotations`, settings);
    });
}

function getThemeFonts(theme) {
    const fonts = {};

    for (const [key, value] of Object.entries(theme.assets)) {
        if (theme.assets[key].type === 'font') fonts[key] = value;
    }
    return fonts;
}
