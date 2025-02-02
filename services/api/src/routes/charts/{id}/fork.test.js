const assignDeep = require('assign-deep');
const cloneDeep = require('lodash/cloneDeep');
const { Chart, ChartPublic } = require('@datawrapper/orm/db');
const { defaultChartMetadata } = require('@datawrapper/service-utils');
const test = require('ava');
const {
    createGuestSession,
    createPublicChart,
    createUser,
    destroy,
    getChart,
    setup
} = require('../../../../test/helpers/setup');
const { decamelizeKeys } = require('humps');

test.before(async t => {
    t.context.server = await setup({ usePlugins: false });
});

test('POST /charts/{id}/fork returns 401 when the original chart is not forkable', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server);
        const { session } = userObj;
        const headers = {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost'
        };

        const attributes = {
            title: 'This is my chart',
            theme: 'datawrapper-data',
            language: 'en-IE',
            externalData: 'https://static.dwcdn.net/data/12345.csv',
            metadata: {
                visualize: {
                    basemap: 'us-counties'
                }
            }
        };

        // create a new chart
        const createResponse = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers,
            payload: attributes
        });

        t.is(createResponse.statusCode, 201);

        chart = createResponse.result;

        // fork new chart
        const forkResponse = await t.context.server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers
        });

        t.is(forkResponse.statusCode, 401);
    } finally {
        if (chart) {
            await Chart.destroy({ where: { id: chart.id } });
        }
        await destroy(Object.values(userObj));
    }
});

test('POST /charts/{id}/fork returns 404 when the original chart is not published', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server);
        const { session } = userObj;
        const headers = {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost'
        };

        const attributes = {
            title: 'This is my chart',
            theme: 'datawrapper-data',
            language: 'en-IE',
            forkable: true,
            externalData: 'https://static.dwcdn.net/data/12345.csv',
            metadata: {
                visualize: {
                    basemap: 'us-counties'
                }
            }
        };

        // create a new chart
        const createResponse = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers,
            payload: attributes
        });

        chart = createResponse.result;

        // fork new chart
        const forkResponse = await t.context.server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers
        });

        t.is(forkResponse.statusCode, 404);
    } finally {
        if (chart) {
            await Chart.destroy({ where: { id: chart.id } });
        }
        await destroy(Object.values(userObj));
    }
});

test('POST /charts/{id}/fork forks a fork-protected chart and the attributes match', async t => {
    let userObj = {};
    let chart;
    let publicChart;
    let forkedChart;
    try {
        userObj = await createUser(t.context.server);
        const { user, session } = userObj;
        const { server } = t.context;
        const headers = {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost'
        };

        const attributes = {
            title: 'This is my chart',
            theme: 'datawrapper-data',
            language: 'en-IE',
            externalData: 'https://static.dwcdn.net/data/12345.csv',
            forkable: true,
            metadata: {
                describe: {
                    byline: 'Lorem Ipsum'
                },
                visualize: {
                    basemap: 'us-counties'
                }
                // this is the default, so we don't need to set it
                // publish: {
                //     'protect-forks': true
                // }
            }
        };

        // create a new chart
        const createResponse = await server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers,
            payload: attributes
        });

        chart = createResponse.result;

        t.true(chart.forkable);

        // upload some data
        const dataResponse = await server.inject({
            method: 'PUT',
            url: `/v3/charts/${chart.id}/data`,
            headers,
            payload: 'foo,bar\n12,23'
        });

        t.is(dataResponse.statusCode, 204);

        // create ChartPublic manually since /publish isn't working from tests yes
        publicChart = await ChartPublic.create(decamelizeKeys(createResponse.result));

        // fork new chart
        const forkResponse = await server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers
        });

        t.is(forkResponse.statusCode, 201);

        forkedChart = forkResponse.result;

        const allMetadata = await server.inject({
            method: 'GET',
            url: `/v3/charts/${forkedChart.id}`,
            headers
        });

        t.is(allMetadata.statusCode, 200);

        t.is(forkedChart.authorId, user.id);
        t.is(forkedChart.forkedFrom, chart.id);
        t.is(allMetadata.result.externalData, attributes.externalData);

        const expectedAttributes = {
            ...attributes,
            theme: 'default',
            language: 'en-US',
            isFork: true,
            forkable: undefined, // not returned from API,
            metadata: assignDeep(cloneDeep(defaultChartMetadata), {
                ...attributes.metadata,
                describe: {
                    intro: '',
                    'source-name': '',
                    'source-url': '',
                    'aria-description': '',
                    byline: '' // byline gets cleared since it's a protected fork
                },
                visualize: {
                    basemap: 'us-counties',
                    'map-type-set': true
                }
            })
        };

        // compare attributes
        for (var attr in expectedAttributes) {
            if (attr === 'metadata') {
                t.deepEqual(forkedChart.metadata.visualize, expectedAttributes.metadata.visualize);
                t.deepEqual(forkedChart.metadata.describe, expectedAttributes.metadata.describe);
            } else {
                t.deepEqual(forkedChart[attr], expectedAttributes[attr], attr);
            }
        }
    } finally {
        if (forkedChart) {
            await Chart.destroy({ where: { id: forkedChart.id } });
        }
        await destroy(publicChart);
        if (chart) {
            await Chart.destroy({ where: { id: chart.id } });
        }
        await destroy(userObj);
    }
});

test('POST /charts/{id}/fork forks an unprotected chart and the attributes match', async t => {
    let userObj = {};
    let chart;
    let publicChart;
    let forkedChart;
    try {
        userObj = await createUser(t.context.server);
        const { user, session } = userObj;
        const { server } = t.context;
        const headers = {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost'
        };

        const attributes = {
            title: 'This is my chart',
            theme: 'datawrapper-data',
            language: 'en-IE',
            externalData: 'https://static.dwcdn.net/data/12345.csv',
            forkable: true,
            metadata: {
                describe: {
                    byline: 'Lorem Ipsum'
                },
                visualize: {
                    basemap: 'us-counties'
                },
                publish: {
                    'protect-forks': false
                }
            }
        };

        // create a new chart
        const createResponse = await server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers,
            payload: attributes
        });

        chart = createResponse.result;

        t.true(chart.forkable);

        // upload some data
        const dataResponse = await server.inject({
            method: 'PUT',
            url: `/v3/charts/${chart.id}/data`,
            headers,
            payload: 'foo,bar\n12,23'
        });

        t.is(dataResponse.statusCode, 204);

        // create ChartPublic manually since /publish isn't working from tests yet
        publicChart = await ChartPublic.create(decamelizeKeys(chart));

        // fork new chart
        const forkResponse = await server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers
        });

        t.is(forkResponse.statusCode, 201);

        forkedChart = forkResponse.result;

        const allMetadata = await server.inject({
            method: 'GET',
            url: `/v3/charts/${forkedChart.id}`,
            headers
        });

        t.is(forkedChart.authorId, user.id);
        t.is(forkedChart.forkedFrom, chart.id);
        t.is(allMetadata.result.externalData, attributes.externalData);

        const expectedAttributes = {
            ...attributes,
            theme: 'default',
            language: 'en-US',
            isFork: false,
            forkable: undefined, // not returned in API response
            metadata: assignDeep(cloneDeep(defaultChartMetadata), {
                ...attributes.metadata,
                describe: {
                    intro: '',
                    'source-name': '',
                    'source-url': '',
                    'aria-description': '',
                    byline: 'Lorem Ipsum' // byline remains
                },
                visualize: {
                    basemap: 'us-counties',
                    'map-type-set': true
                }
            })
        };

        // compare attributes
        for (var attr in expectedAttributes) {
            if (attr === 'metadata') {
                t.deepEqual(forkedChart.metadata.visualize, expectedAttributes.metadata.visualize);
                t.deepEqual(forkedChart.metadata.describe, expectedAttributes.metadata.describe);
            } else {
                t.deepEqual(forkedChart[attr], expectedAttributes[attr], attr);
            }
        }
    } finally {
        if (forkedChart) {
            await Chart.destroy({ where: { id: forkedChart.id } });
        }
        await destroy(publicChart);
        if (chart) {
            await Chart.destroy({ where: { id: chart.id } });
        }
        await destroy(Object.values(userObj));
    }
});

test('POST /charts/{id}/fork forks a chart and the assets match', async t => {
    let userObj = {};
    let chart;
    let publicChart;
    let forkedChartId;
    try {
        userObj = await createUser(t.context.server);
        const { session } = userObj;
        const { server } = t.context;

        const csv = `Col1,Col2
        10,20
        15,7`;

        const basemap = { type: 'FeatureCollection', features: [] };

        // create a new chart
        const createResponse = await server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost'
            },
            payload: {
                forkable: true
            }
        });

        chart = await Chart.findByPk(createResponse.result.id);

        // write chart data
        const writeData = await server.inject({
            method: 'PUT',
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost',
                'Content-Type': 'text/csv'
            },
            url: `/v3/charts/${chart.id}/data`,
            payload: csv
        });

        t.is(writeData.statusCode, 204);

        // write custom basemap
        const writeBasemap = await server.inject({
            method: 'PUT',
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost',
                'Content-Type': 'application/json'
            },
            url: `/v3/charts/${chart.id}/assets/${chart.id}.map.json`,
            payload: basemap
        });

        t.is(writeBasemap.statusCode, 204);

        // create ChartPublic manually since /publish isn't working from tests yet
        publicChart = await ChartPublic.create(decamelizeKeys(createResponse.result));

        // also create "public" dataset
        const { events, event } = server.app;
        await events.emit(event.PUT_CHART_ASSET, {
            chart,
            data: csv,
            filename: `${chart.id}.public.csv`
        });

        // fork new chart
        const forkedChart = await t.context.server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost'
            }
        });
        forkedChartId = forkedChart.result.id;

        // compare data
        const forkedData = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${forkedChart.result.id}/data`,
            headers: {
                cookie: `DW-SESSION=${session.id}`
            }
        });

        t.is(forkedData.result, csv);

        // compare basemap
        const forkedBasemap = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${forkedChart.result.id}/assets/${forkedChart.result.id}.map.json`,
            headers: {
                cookie: `DW-SESSION=${session.id}`
            }
        });

        t.is(forkedBasemap.result, JSON.stringify(basemap));
    } finally {
        if (forkedChartId) {
            await Chart.destroy({ where: { id: forkedChartId } });
        }
        await destroy(publicChart, chart, Object.values(userObj));
    }
});

test('POST /charts/{id}/fork creates a fork when the user is a guest', async t => {
    let userObj = {};
    let chart;
    let fork;
    try {
        userObj = await createUser(t.context.server);
        const session = await createGuestSession(t.context.server);
        const headers = {
            cookie: `DW-SESSION=${session}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost'
        };

        chart = await createPublicChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: true,
            is_fork: false
        });

        const res = await t.context.server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`,
            headers
        });

        t.is(res.statusCode, 201);

        fork = await getChart(res.result.id);
        t.truthy(fork);
        t.is(fork.title, 'Chart 1');
        t.is(fork.is_fork, true);
        t.is(fork.forked_from, chart.id);
        t.is(fork.author_id, null);
        t.is(fork.guest_session, session);
    } finally {
        await destroy(fork, chart, Object.values(userObj));
    }
});

test('POST /charts/{id}/fork returns 401 for unathorized requests', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server);

        chart = await createPublicChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: true,
            is_fork: false
        });

        const res = await t.context.server.inject({
            method: 'POST',
            url: `/v3/charts/${chart.id}/fork`
        });

        t.is(res.statusCode, 401);
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});
