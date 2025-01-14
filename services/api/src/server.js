const Boom = require('@hapi/boom');
const {
    initGCTrap,
    registerFeatureFlag,
    createRegisterVisualization,
    computeFileHashPlugin,
    addLocalizationScope,
    translate,
    getTranslate
} = require('@datawrapper/service-utils');
const Crumb = require('@hapi/crumb');
const Hapi = require('@hapi/hapi');
const HapiSwagger = require('hapi-swagger');
const Joi = require('joi');
const { initORM } = require('@datawrapper/orm');
const { Action, Plugin } = require('@datawrapper/orm/db');
const fs = require('fs-extra');
const get = require('lodash/get');
const path = require('path');
const Schemas = require('@datawrapper/schemas');
const { ApiEventEmitter, eventList } = require('./utils/events');
const { getGitRevision, requireConfig } = require('@datawrapper/backend-utils');
const { generateToken, loadChart } = require('./utils');
const {
    validateAPI,
    validateORM,
    validateFrontend,
    validateRedis,
    validatePlugins
} = require('@datawrapper/schemas/config');

initGCTrap();

const pkg = require('../package.json');
const DW_DEV_MODE = !!JSON.parse(process.env.DW_DEV_MODE || 'false');

/**
 * Instantiate a Hapi Server instance and configure it.
 */
async function create({
    usePlugins = true,
    useOpenAPI = true,
    testsConfigPatcher = config => config,
    db = undefined
} = {}) {
    const config = testsConfigPatcher(requireConfig());

    const CSRF_COOKIE_NAME = 'crumb';
    const CSRF_COOKIE_OPTIONS = {
        domain: '.' + config.api.domain,
        isHttpOnly: false,
        isSameSite: 'Lax',
        isSecure: config.frontend.https
    };

    validateAPI(config.api);
    validateORM(config.orm);
    validateFrontend(config.frontend);
    validatePlugins(config.plugins);

    let useRedis = !!config.redis;

    if (useRedis) {
        try {
            validateRedis(config.redis);
        } catch (error) {
            useRedis = false;
            console.warn('[Cache] Invalid Redis configuration, falling back to in memory cache.');
        }
    }

    const host = config.api.subdomain
        ? `${config.api.subdomain}.${config.api.domain}`
        : config.api.domain;
    const scheme = config.frontend.https ? 'https' : 'http';

    const port = config.api.port || 3000;

    const OpenAPI = {
        plugin: HapiSwagger,
        options: {
            debug: DW_DEV_MODE,
            host: DW_DEV_MODE ? `${host}:${port}` : host,
            schemes: [scheme],
            grouping: 'tags',
            info: {
                title: 'Datawrapper API v3 Documentation',
                version: pkg.version,
                'x-info': DW_DEV_MODE
                    ? {
                          node: process.version,
                          hapi: pkg.dependencies.hapi
                      }
                    : undefined
            },
            sortPaths: 'path-method',
            jsonPath: '/',
            basePath: '/v3/',
            documentationPage: DW_DEV_MODE,
            swaggerUI: DW_DEV_MODE,
            deReference: true
        }
    };

    const server = Hapi.server({
        host: 'localhost',
        address: '0.0.0.0',
        port,
        tls: false,
        router: { stripTrailingSlash: true },
        /* https://hapijs.com/api#-serveroptionsdebug */
        debug: DW_DEV_MODE ? { request: ['implementation'] } : false,
        cache: {
            provider: useRedis
                ? {
                      constructor: require('@hapi/catbox-redis'),
                      options: {
                          ...config.redis,
                          partition: 'api'
                      }
                  }
                : {
                      constructor: require('@hapi/catbox-memory'),
                      options: {
                          maxByteSize: 52480000
                      }
                  }
        },
        routes: {
            cors: {
                origin: config.api.cors,
                additionalHeaders: ['X-CSRF-Token'],
                credentials: true
            },
            validate: {
                /**
                 * Adds Joi validation details to the Boom error object.
                 *
                 * This allows us to later return the details to the client in `onPreResponse`.
                 */
                async failAction(_request, _h, err) {
                    throw Boom.badRequest('Invalid request payload input: ' + err.message, {
                        ...(err.isJoi && {
                            type: 'validation-error',
                            details: err.details.map(({ path, type }) => ({
                                path: path.join('.'),
                                type
                            }))
                        })
                    });
                }
            }
        }
    });

    /**
     * Wrap cache get(), set() and drop() to not crash the API when Redis is temporarily unavailable.
     */
    server.events.on('cachePolicy', cachePolicy => {
        for (const methodName of ['get', 'set', 'drop']) {
            const oldMethod = cachePolicy[methodName];
            cachePolicy[methodName] = async function wrapped() {
                try {
                    return await oldMethod.apply(cachePolicy, arguments);
                } catch (e) {
                    server.logger.error(`[Cache] Error while calling cache.${methodName}: ${e}`);
                    return null;
                }
            };
        }
    });

    const rev = await getGitRevision();
    const revShort = rev && rev.slice(0, 8);
    await server.register([
        {
            plugin: require('hapi-pino'),
            options: {
                prettyPrint: true,
                timestamp: () => `,"time":"${new Date().toISOString()}"`,
                logEvents: ['request', 'log', 'onPostStart', 'onPostStop', 'request-error'],
                level: getLogLevel(),
                base: { name: revShort },
                redact: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'res.headers["set-cookie"]'
                ]
            }
        },
        {
            plugin: Crumb,
            options: {
                key: CSRF_COOKIE_NAME,
                cookieOptions: CSRF_COOKIE_OPTIONS,
                logUnauthorized: config.api.logCSRFUnauthorized,
                restful: true,
                skip: function (request) {
                    // Allow cross-site requests that are not authenticated with a cookie, because
                    // where there are no cookies, there is no CSRF risk.
                    return !usesCookieAuth(request);
                }
            }
        }
    ]);

    server.method('config', key => (key ? get(config, key) : config));
    server.method('isDevMode', () => DW_DEV_MODE);

    await server.register({
        plugin: require('./utils/sentry'),
        options: { release: rev }
    });

    if (config.api.matomo) {
        await server.register(require('./utils/matomo'));
    }

    server.ext('onPostAuth', (request, h) => {
        if (request.auth.credentials?.data?.get && request._states[CSRF_COOKIE_NAME]) {
            const sessionType = request.auth.credentials.data.get('data').type;
            if (sessionType === 'token') {
                request._states[CSRF_COOKIE_NAME].options.isSameSite = 'None';
            }
        }
        return h.continue;
    });

    server.logger.info(
        {
            VERSION: revShort,
            NODE_ENV: process.env.NODE_ENV,
            NODE_VERSION: process.version,
            PID: process.pid
        },
        '[Initialize] Starting server ...'
    );

    // load translations
    try {
        const localePath = path.join(__dirname, '../locale');
        const localeFiles = await fs.readdir(localePath);
        const locales = {};
        for (let i = 0; i < localeFiles.length; i++) {
            const file = localeFiles[i];
            if (/[a-z]+_[a-z]+\.json/i.test(file)) {
                locales[file.split('.')[0]] = JSON.parse(
                    await fs.readFile(path.join(localePath, file))
                );
            }
        }
        addLocalizationScope('core', locales);
    } catch (e) {
        server.logger.debug('Error while loading translations', e);
    }
    // Initialize the 'chart' scope, otherwise the app crashes when there are some visualization
    // plugins but none of them contain a chart-translations.json file (e.g. only the d3-bars
    // plugin).
    addLocalizationScope('chart', { 'en-US': {} });

    if (!db) {
        const orm = await initORM(config);
        db = orm.db;
        await orm.registerPlugins(server.logger);
    }

    /* register api plugins with core db */
    Plugin.register('datawrapper-api', Object.keys(config.plugins));

    server.validator(Joi);

    /**
     * Adds additional properties 'type' and 'details' to hapi's error JSON responses.
     *
     * We use these properties to provide translated error messages in the frontend.
     *
     * @see HttpReqError
     * @see https://github.com/hapijs/hapi/blob/master/API.md#error-transformation
     */
    server.ext('onPreResponse', ({ response }, h) => {
        if (response?.isBoom) {
            for (const key of ['type', 'details']) {
                if (response.data?.[key]) {
                    response.output.payload[key] = response.data[key];
                }
            }
        }
        return h.continue;
    });

    server.app.event = eventList;
    server.app.events = new ApiEventEmitter({ logger: server.logger, eventList });
    server.app.exportFormats = new Set();
    server.app.scopes = new Set();
    server.app.adminScopes = new Set();

    server.method('getDB', () => db);
    server.method('getModel', name => db.models[name]);
    server.method('generateToken', generateToken);
    server.method('logAction', (...args) => Action.logAction(...args));
    server.method('createChartWebsite', require('./utils/publish/create-chart-website.js'));
    server.method('registerVisualization', createRegisterVisualization(server));
    server.method('registerFeatureFlag', registerFeatureFlag(server));
    server.register(require('./utils/jobs'));

    await server.register(computeFileHashPlugin);

    server.method('getScopes', (admin = false) => {
        return admin
            ? [...server.app.scopes, ...server.app.adminScopes]
            : Array.from(server.app.scopes);
    });
    server.method('translate', translate);
    server.method('getTranslate', getTranslate);

    const schemas = new Schemas({
        ...(config.api.schemaBaseUrl && { loadSchema: loadSchemaFromUrl(config.api.schemaBaseUrl) })
    });
    server.method('getSchemas', () => schemas);
    server.method('loadChart', loadChart);

    if (DW_DEV_MODE) {
        server.register([require('@hapi/inert'), require('@hapi/vision')]);
    }

    await server.register(require('./utils/auth/dw-auth'));

    const routeOptions = {
        routes: { prefix: '/v3' }
    };
    if (useOpenAPI) {
        await server.register(OpenAPI, routeOptions);
    }

    await server.register([require('./routes')], routeOptions);

    if (usePlugins) {
        await server.register([require('./plugin-loader')], routeOptions);
    }
    await server.register(require('./utils/chartAssets.js'));

    const { events, event } = server.app;

    const { general } = server.methods.config();
    const registeredEvents = events.eventNames();
    const hasRegisteredPublishPlugin = registeredEvents.includes(event.PUBLISH_CHART);

    if (general.localChartPublishRoot === undefined && !hasRegisteredPublishPlugin) {
        server.logger.error(
            '[Config] You need to configure `general.localChartPublishRoot` or install a plugin that implements chart publication.'
        );
        process.exit(1);
    }

    if (!hasRegisteredPublishPlugin) {
        events.on(event.PUBLISH_CHART, async ({ chart, outDir, fileMap }) => {
            const publicId = await chart.getPublicId();
            const dest = path.resolve(general.localChartPublishRoot, publicId);

            if (process.env.NODE_ENV === 'test') {
                console.warn(
                    'Skipping copying of published chart files while running tests due to I/O issues'
                );
            } else {
                for (const file of fileMap) {
                    const basename = path.basename(file.path);
                    const dir = path.dirname(file.path);

                    const out =
                        dir === '.'
                            ? path.resolve(dest, basename)
                            : path.resolve(dest, '..', dir, basename);

                    await fs.copy(path.join(outDir, basename), out, { overwrite: dir === '.' });
                }
            }

            await fs.remove(outDir);

            return `${scheme}://${general.chart_domain}/${publicId}`;
        });

        events.on(event.GET_NEXT_PUBLIC_URL, async function ({ chart }) {
            const publicId = await chart.getPublicId();
            return `${scheme}://${general.chart_domain}/${publicId}`;
        });
    }

    server.route({
        method: '*',
        path: '/{p*}',
        options: {
            auth: false
        },
        handler: (request, h) => {
            const { pathname = '' } = get(request, 'url', {});
            if (pathname.startsWith('/3')) {
                return h.redirect(pathname.replace('/3', '/v3')).permanent();
            }

            return Boom.notFound();
        }
    });

    return server;
}

/**
 * Start passed Hapi Server instance and handle process signals.
 */
async function start(server) {
    process.on('unhandledRejection', err => {
        server.logger.error(err);
        process.exit(1);
    });

    if (process.argv.includes('--check') || process.argv.includes('-c')) {
        server.logger.info("\n\n[Check successful] The server shouldn't crash on startup");
        process.exit(0);
    }

    server.start();

    setTimeout(() => {
        if (process.send) {
            server.logger.info('sending READY signal to pm2');
            process.send('ready');
        }
    }, 100);

    process.on('SIGINT', async function () {
        server.logger.info('received SIGINT signal, closing all connections...');
        await server.stop();
        server.logger.info('server has stopped');
        process.exit(0);
    });
}

function getLogLevel() {
    if (DW_DEV_MODE) {
        return 'debug';
    }
    if (process.env.NODE_ENV === 'test') {
        return 'error';
    }
    return 'info';
}

function usesCookieAuth(request) {
    return get(request, 'auth.isAuthenticated') && get(request, 'auth.credentials.session');
}

function loadSchemaFromUrl(baseUrl) {
    const got = require('got');
    const cache = {};
    return async id => {
        // use cached schema if available
        if (cache[id]) return cache[id];
        // fetch schema from URL
        const body = await got(`${id}.json`, { prefixUrl: baseUrl }).json();
        cache[id] = body;
        // delete cache after 5 minutes
        setTimeout(() => {
            delete cache[id];
        }, 5 * 6e4);

        return body;
    };
}

module.exports = {
    create,
    start
};
