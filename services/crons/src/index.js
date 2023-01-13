const cron = require('node-cron');
const { fetchAllPlugins, requireConfig } = require('@datawrapper/backend-utils');
const { validateRedis } = require('@datawrapper/schemas/config');
const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');
const CatboxMemory = require('@hapi/catbox-memory');
const { initORM } = require('@datawrapper/orm');
const { Plugin } = require('@datawrapper/orm/db');
const Redis = require('ioredis');
const { eventList, CronsEventEmitter } = require('./events');
const { createJobsHelper } = require('./jobs');

const config = requireConfig();

module.exports = async function ({ db } = {}) {
    const logger = require('./logger');

    if (!db) {
        const orm = await initORM(config);
        db = orm.db;
        await orm.registerPlugins(logger);
    }

    // register api plugins with core db
    Plugin.register('datawrapper-api', Object.keys(config.plugins));

    let redis;
    if (config.redis) {
        try {
            validateRedis(config.redis);
            redis = new Redis(config.redis);
        } catch (error) {
            console.warn('[Cache] Invalid Redis configuration, falling back to in memory cache.');
        }
    }

    let cacheConnection = null;
    if (redis) {
        cacheConnection = new Catbox.Client(CatboxRedis, {
            client: redis,
            partition: 'api'
        });
    } else {
        cacheConnection = new Catbox.Client(CatboxMemory, {
            maxByteSize: 52480000
        });
    }

    await cacheConnection.start();

    const taskOptions = {
        cron,
        logger,
        db,
        createCache(options, segment) {
            return new Catbox.Policy(options, cacheConnection, segment);
        },
        redis,
        event: eventList,
        events: new CronsEventEmitter({ logger, eventList }),
        jobsHelper: createJobsHelper({
            config,
            db,
            logger
        }),
        config
    };

    const schedule = (taskName, cronExpression, func) =>
        cron.schedule(cronExpression, (...args) => func(taskOptions, ...args), undefined, taskName);

    const scheduleFromFile = (cronExpression, filename) =>
        schedule(filename, cronExpression, require(`./tasks/${filename}`));

    logger.info('Initializing crons...');

    //
    // JUST ADD THE CRONS BELOW
    //

    // queue export jobs for recently edited charts every minute
    scheduleFromFile('* * * * *', 'queue-editor-screenshots');

    // invalidate cloudflare cache for recently created chart screenshots
    scheduleFromFile('* * * * *', 'invalidate-screenshot-cache');

    // collect some stats about charts
    const chartStats = require('./tasks/chart-stats');
    schedule('chart-stats-minutely', '* * * * *', chartStats.minutely);
    schedule('chart-stats-hourly', '0 * * * *', chartStats.hourly);
    schedule('chart-stats-daily', '0 0 * * *', chartStats.daily);
    schedule('chart-stats-weekly', '0 0 * * 0', chartStats.weekly);
    schedule('chart-stats-monthly', '0 0 1 * *', chartStats.monthly);

    // collect some stats about users and teams
    const userTeamStats = require('./tasks/user-team-stats');
    schedule('user-team-stats-daily', '0 0 * * *', userTeamStats.daily);
    schedule('user-team-stats-weekly', '0 0 * * 0', userTeamStats.weekly);
    schedule('user-team-stats-monthly', '0 0 1 * *', userTeamStats.monthly);

    // collect stats for export-jobs every hour
    const exportJobStats = require('./tasks/export-job-stats');
    schedule('export-job-stats-daily', '0 0 * * *', exportJobStats.daily);
    schedule('export-job-stats-hourly', '0 * * * *', exportJobStats.hourly);
    schedule('export-job-stats-minutely', '* * * * *', exportJobStats.minutely);

    // collect some stats about api tokens (at 1am)
    const apiTokenStats = require('./tasks/api-token-stats');
    schedule('api-token-stats-daily', '0 1 * * *', apiTokenStats.daily);
    schedule('api-token-stats-weekly', '0 1 * * 0', apiTokenStats.weekly);
    schedule('api-token-stats-monthly', '0 1 1 * *', apiTokenStats.monthly);

    // remove expired products from users, every 5 minutes
    scheduleFromFile('*/5 * * * *', 'remove-expired-products');
    // remove expired password reset tokens, every day at 3am
    scheduleFromFile('0 3 * * *', 'remove-expired-pwd-reset-tokens');
    // remove old export jobs day at 2am
    scheduleFromFile('0 2 * * *', 'remove-old-export-jobs');
    // remove expired sessions every day at 3:05 am
    scheduleFromFile('5 3 * * *', 'remove-expired-sessions');
    scheduleFromFile('5 3 * * *', 'remove-admin-sessions');

    // hourly remove login tokens older than 1h
    scheduleFromFile('0 * * * *', 'remove-expired-login-tokens');

    // every 12 hours remove export tokens older than 1d
    scheduleFromFile('0 */12 * * *', 'remove-expired-export-tokens');

    const runTestCleanup = require('./tasks/run-test-cleanup');
    schedule('run-test-cleanup', '23 14 * * * *', () => runTestCleanup().catch(logger.error));

    // plugins may define crons as well

    // load plugins
    const pluginsInfo = await fetchAllPlugins(config);

    Object.entries(pluginsInfo).forEach(registerPlugin);

    function registerPlugin([name, { pluginConfig, entryPoints }]) {
        if (!entryPoints.crons) {
            return;
        }

        // load the plugin
        let plugin;
        try {
            plugin = require(entryPoints.crons);
        } catch (e) {
            logger.error(`error while importing cron plugin ${name}: ${e}`);
            return;
        }

        // call the hook
        if (typeof plugin.register === 'function') {
            const pluginDefaultConfig = entryPoints.config ? require(entryPoints.config) : {};

            // extend default plugin cfg with our custom config
            const pluginFinalConfig = Object.assign(pluginDefaultConfig, pluginConfig);

            logger.info(`hooked in plugin ${name}...`);
            plugin.register({
                ...taskOptions,
                config: {
                    global: taskOptions.config,
                    plugin: pluginFinalConfig
                }
            });
        } else {
            logger.error(
                `plugin ${name} has crons module but the module does not export 'register'`
            );
        }
    }

    logger.info('Crons is up and running...');
};
