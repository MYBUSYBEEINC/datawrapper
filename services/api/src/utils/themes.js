const Joi = require('joi');
const Boom = require('@hapi/boom');
const assign = require('assign-deep');
const get = require('lodash/get.js');
const { Theme } = require('@datawrapper/orm/db');
const { compileCSS } = require('@datawrapper/chart-core/lib/styles/compile-css.js');

function getThemeCacheKey(id, { dark = false, extend = false } = {}) {
    return `${id}?dark=${dark}&extend=${extend}`;
}

module.exports.getThemeCacheKey = getThemeCacheKey;

module.exports.dropCache = async function ({ theme, themeCache, styleCache, visualizations }) {
    const descendants = await findDescendants(theme);

    for (const t of descendants) {
        if (styleCache) {
            for (const visId of visualizations.keys()) {
                const vis = visualizations.get(visId);
                await styleCache.drop(`${t.id}__${visId}__${vis.__styleHash}`);
                await styleCache.drop(`${t.id}__${visId}__dark__${vis.__styleHash}`);
                await styleCache.drop(`${t.id}__${visId}`);
            }
        }

        if (themeCache) {
            await themeCache.drop(getThemeCacheKey(t.id));
            await themeCache.drop(getThemeCacheKey(t.id, { dark: true }));
            await themeCache.drop(getThemeCacheKey(t.id, { extend: true }));
            await themeCache.drop(getThemeCacheKey(t.id, { dark: true, extend: true }));
        }
    }
};

module.exports.getCaches = function (server) {
    const config = server.methods.config();
    const useThemeCache = get(config, 'general.cache.themes');
    const useStyleCache = get(config, 'general.cache.styles');
    return {
        styleCache: useStyleCache
            ? server.cache({ segment: 'vis-styles', shared: true })
            : undefined,
        themeCache: useThemeCache
            ? server.cache({
                  segment: 'themes',
                  shared: true,
                  expiresIn: 30 * 864e5 /* 30 days */
              })
            : undefined
    };
};

async function findDescendants(theme) {
    let checkNext = [theme];
    const descendants = [theme];

    while (checkNext.length) {
        // find all themes that extend from current
        const children = await Theme.findAll({
            where: { extend: checkNext.map(el => el.id) }
        });

        children.forEach(child => {
            descendants.push(child);
        });

        checkNext = children;
    }
    return descendants;
}

module.exports.themeId = () =>
    Joi.string()
        .lowercase()
        .pattern(/^[a-z0-9]+(?:-{0,2}[a-z0-9]+)*$/)
        .min(2);

module.exports.validateThemeData = async function (data, server) {
    try {
        await server.methods.getSchemas().validateThemeData(data);
    } catch (err) {
        if (err.name === 'ValidationError') {
            throw Boom.badRequest(err.details.map(e => `- ${e.message}`).join('\n'));
        } else {
            throw err;
        }
    }
};

module.exports.validateThemeLess = async function (less, server, themeId, data) {
    try {
        let extendedThemeData = {};
        if (server && themeId) {
            const { result: theme } = await server.inject({
                url: `/v3/themes/${themeId}?extend=true`
            });
            extendedThemeData = theme.data;
            if (data) assign(extendedThemeData, data);
        }
        const themeToValidate = { less, data: extendedThemeData };
        await compileCSS({
            theme: themeToValidate,
            filePaths: []
        });
    } catch (err) {
        if (['Parse', 'Name'].includes(err.type)) {
            throw Boom.badRequest(`LESS error: "${err.message}"`);
        } else {
            throw err;
        }
    }
};
