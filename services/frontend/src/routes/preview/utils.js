const get = require('lodash/get');
const Boom = require('@hapi/boom');
const createEmotion = require('@emotion/css/create-instance').default;
const createEmotionServer = require('@emotion/server/create-instance').default;
const { JSDOM } = require('jsdom');
const { Team } = require('@datawrapper/orm/db');
const chartCore = require('@datawrapper/chart-core');
const { loadVendorLocale, loadLocaleConfig } = require('@datawrapper/service-utils');
const Joi = require('joi');
const { fakeBoolean, id: logoId } = require('@datawrapper/schemas/themeData/shared');

async function getChart(server, request) {
    const api = server.methods.createAPI(request);
    const { query, params } = request;
    const { chartId } = params;

    const queryString = Object.entries({
        published: query.published,
        chartExportToken: query.chartExportToken,
        ott: query.ott,
        theme: query.theme,
        transparent: query.transparent
    })
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    let props;

    try {
        props = await api(`/charts/${chartId}/publish/data?${queryString}`);
    } catch (ex) {
        throw Boom.notFound();
    }

    // also load dark mode theme & styles
    const themeDark = {};
    const themeId = props.chart.theme;

    if (!server.app.visualizations.has(props.chart.type)) {
        throw Boom.badRequest('Invalid visualization type');
    }

    const darkThemePromises = [
        `/themes/${themeId}?extend=true&dark=true`,
        `/visualizations/${props.chart.type}/styles.css?theme=${themeId}&dark=true`
    ].map((url, i) =>
        api(url, { json: i === 0 }).then(res => {
            themeDark[i === 0 ? 'json' : 'css'] = res;
        })
    );

    await Promise.all(darkThemePromises);

    return { props, themeDark };
}

module.exports = {
    getChart,
    initCaches(server) {
        const config = server.methods.config();

        const styleCache = server.cache({
            segment: 'vis-styles',
            expiresIn: 86400000 * 365 /* 1 year */,
            shared: true
        });

        const visCache = server.cache({
            segment: 'visualizations',
            expiresIn: 86400000 /* 1 day */,
            shared: true
        });

        const themeCache = server.cache({
            segment: 'themes',
            expiresIn: 86400000 /* 1 day */,
            shared: true
        });

        return {
            async getStyles(api, visId, themeId, transparent) {
                if (get(config, 'general.cache.styles') && !transparent) {
                    const cachedCSS = await styleCache.get(`${themeId}__${visId}`);
                    if (cachedCSS) return cachedCSS;
                }

                return api(
                    `/visualizations/${visId}/styles.css?theme=${themeId}${
                        transparent ? '&transparent=true' : ''
                    }`,
                    {
                        json: false
                    }
                );
            },

            async getVis(api, visId) {
                if (get(config, 'general.cache.visualizations')) {
                    const cachedVis = await visCache.get(visId);
                    if (cachedVis) return cachedVis;
                }

                const vis = await api(`/visualizations/${visId}`);

                if (get(config, 'general.cache.visualizations')) {
                    await visCache.set(visId, vis);
                }

                return vis;
            },

            async getTheme(api, themeId) {
                if (get(config, 'general.cache.themes')) {
                    const cachedTheme = await themeCache.get(themeId);
                    if (cachedTheme) return cachedTheme;
                }

                const theme = await api(`/themes/${themeId}?extend=true`);

                if (get(config, 'general.cache.themes')) {
                    await themeCache.set(themeId, theme);
                }

                return theme;
            }
        };
    },
    renderChart(props) {
        // server-side emotion
        const dom = new JSDOM(`<!DOCTYPE html><head /><body />`);
        const emotion = createEmotion({
            key: `datawrapper`,
            container: dom.window.document.head
        });
        const { html, head } = chartCore.svelte.render({ ...props, emotion });
        const { extractCritical } = createEmotionServer(emotion.cache);
        const { css } = extractCritical(html);
        return { html, head, css };
    },
    async getEmbedProps(server, request) {
        const res = await getChart(server, request);
        const config = server.methods.config();
        const frontendBase = `${config.frontend.https ? 'https' : 'http'}://${
            config.frontend.domain
        }`;
        const { props } = res;
        const { themeDark } = res;

        const chartLocale = props.chart.language || 'en-US';
        const team = await Team.findByPk(props.chart.organizationId);

        const themeAutoDark = get(props.theme.data, 'options.darkMode.auto', 'user');
        const chartAutoDark =
            themeAutoDark === 'user'
                ? get(props.chart, 'metadata.publish.autoDarkMode', false)
                : themeAutoDark;

        const localeConfig = await loadLocaleConfig(chartLocale);

        return Object.assign(props, {
            isIframe: false,
            isPreview: true,
            isStyleDark: request.query.dark,
            chartAutoDark,
            themeDataDark: themeDark.json.data,
            themeDataLight: props.theme.data,
            themeCSSDark: themeDark.css,
            polyfillUri: '/lib/polyfills',
            themeFonts: Object.fromEntries(
                Object.entries(props.theme.assets).filter(([, asset]) => asset.type === 'font'),
                props.theme.data
            ),
            theme: {
                id: props.theme.id,
                title: props.theme.title,
                // we can safely omit theme.data, theme.fonts and theme.assets here
                // since we're already including them as top level props
                _computed: props.theme._computed
            },
            locales: {
                dayjs: await loadVendorLocale('dayjs', chartLocale, team),
                numeral: await loadVendorLocale('numeral', chartLocale, team)
            },
            textDirection: localeConfig.textDirection || 'ltr',
            teamPublicSettings: team ? team.getPublicSettings() : {},
            ...(request.query.dark ? { theme: themeDark.json } : {}),
            assets: Object.fromEntries(props.assets.map(({ name, value }) => [name, { value }])),
            frontendDomain: config.frontend.domain,
            dependencies: [
                `${frontendBase}/lib/chart-core/dw-2.0.min.js`,
                `${frontendBase}/lib/chart-core/web-component.js`,
                ...props.visualization.libraries.map(lib => `${frontendBase}${lib.uri}`),
                `${frontendBase}/lib/plugins/${props.visualization.__plugin}/static/${props.visualization.id}.js`
            ],
            blocks: props.blocks.map(block => {
                block.source.js = `${frontendBase}${block.source.js}`;
                block.source.css = `${frontendBase}${block.source.css}`;
                return block;
            })
        });
    },
    validateEmbedRequest: {
        params: Joi.object({
            chartId: Joi.string()
                .alphanum()
                .length(5)
                .required()
                .description('5 character long chart ID.')
        }),
        query: Joi.object({
            theme: Joi.string().optional(),
            chartExportToken: Joi.string().optional(),
            ott: Joi.string().optional(),
            search: Joi.string().optional(),
            published: fakeBoolean(),
            static: fakeBoolean(),
            plain: fakeBoolean(),
            fitchart: fakeBoolean(),
            fitheight: fakeBoolean(),
            svgonly: fakeBoolean(),
            map2svg: fakeBoolean(),
            transparent: fakeBoolean(),
            logo: Joi.string().optional().valid('auto', 'on', 'off').default('auto'),
            logoId: logoId().optional(),
            dark: Joi.boolean().default(false).allow('auto')
        })
    }
};
