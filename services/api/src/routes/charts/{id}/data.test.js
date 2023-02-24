const test = require('ava');
const { createUser, destroy, setup, createChart } = require('../../../../test/helpers/setup');

async function getData(server, session, chart) {
    return server.inject({
        method: 'GET',
        headers: {
            cookie: `DW-SESSION=${session.id}`
        },
        url: `/v3/charts/${chart.id}/data`
    });
}

async function getAsset(server, session, chart, asset) {
    return server.inject({
        method: 'GET',
        headers: {
            cookie: `DW-SESSION=${session.id}`
        },
        url: `/v3/charts/${chart.id}/assets/${asset}`
    });
}

async function putData(server, session, chart, data, contentType = 'text/csv') {
    return server.inject({
        method: 'PUT',
        headers: {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost',
            'Content-Type': contentType
        },
        url: `/v3/charts/${chart.id}/data`,
        payload: data
    });
}

async function putAsset(server, session, chart, asset, data, contentType = 'text/csv') {
    return server.inject({
        method: 'PUT',
        headers: {
            cookie: `DW-SESSION=${session.id}; crumb=abc`,
            'X-CSRF-Token': 'abc',
            referer: 'http://localhost',
            'Content-Type': contentType
        },
        url: `/v3/charts/${chart.id}/assets/${asset}`,
        payload: data
    });
}

test.before(async t => {
    t.context.server = await setup({ usePlugins: false });
    t.context.userObj = await createUser(t.context.server, { role: 'admin' });
    t.context.auth = {
        strategy: 'session',
        credentials: t.context.userObj.session,
        artifacts: t.context.userObj.user
    };
});

test.after.always(async t => {
    await destroy(...Object.values(t.context.userObj));
});

test('User can read and write chart data', async t => {
    let chart;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server);
        const { session } = userObj;

        // create a new chart with no data
        chart = await createChart({ author_id: userObj.user.id });

        // check that the 'data' enpoint returns error 200 and null when there is no chart data
        let res = await getData(t.context.server, session, chart);
        t.is(res.statusCode, 200);
        t.is(res.result, null);

        // set chart data
        res = await putData(t.context.server, session, chart, 'hello world');
        t.is(res.statusCode, 204);

        // check that the 'data' endpoint returns the CSV data and the headers are correct
        res = await getData(t.context.server, session, chart);
        t.is(res.statusCode, 200);
        t.is(res.result, 'hello world');
        t.is(res.headers['content-type'], 'text/csv; charset=utf-8');
        t.is(res.headers['content-disposition'], `${chart.id}.csv`);

        // check that the 'assets' endpoint returns the CSV data too
        res = await getAsset(t.context.server, session, chart, `${chart.id}.csv`);
        t.is(res.statusCode, 200);
        t.is(res.result, 'hello world');

        // make sure we can't access data for a different chart id
        res = await getAsset(t.context.server, session, chart, '00000.csv');
        t.is(res.statusCode, 400);

        // write some JSON to another asset
        res = await putAsset(
            t.context.server,
            session,
            chart,
            `${chart.id}.map.json`,
            { answer: 42 },
            'application/json'
        );
        t.is(res.statusCode, 204);

        // check that the 'assets' endpoint returns the JSON data
        res = await getAsset(t.context.server, session, chart, `${chart.id}.map.json`);
        t.is(res.statusCode, 200);
        t.deepEqual(JSON.parse(res.result), { answer: 42 });
    } finally {
        await destroy(chart, ...Object.values(userObj));
    }
});

test('GET /charts/{id}/data returns JSON data with JSON headers when the data is an array or an object', async t => {
    let chart;
    try {
        const { session, user } = t.context.userObj;
        chart = await createChart({ author_id: user.id });
        await putData(t.context.server, session, chart, JSON.stringify({ answer: 42 }));

        const res = await getData(t.context.server, session, chart);
        t.is(res.statusCode, 200);
        t.deepEqual(JSON.parse(res.result), { answer: 42 });
        t.is(res.headers['content-type'], 'application/json; charset=utf-8');
        t.is(res.headers['content-disposition'], `${chart.id}.json`);

        await putData(t.context.server, session, chart, JSON.stringify([42]));

        const res2 = await getData(t.context.server, session, chart);
        t.is(res2.statusCode, 200);
        t.deepEqual(JSON.parse(res2.result), [42]);
        t.is(res2.headers['content-type'], 'application/json; charset=utf-8');
        t.is(res2.headers['content-disposition'], `${chart.id}.json`);
    } finally {
        await destroy(chart);
    }
});

test('GET /charts/{id}/data returns JSON data with CSV headers when the data is a number or a string', async t => {
    let chart;
    try {
        const { session, user } = t.context.userObj;
        chart = await createChart({ author_id: user.id });
        await putData(t.context.server, session, chart, '42');

        const res = await getData(t.context.server, session, chart);
        t.is(res.statusCode, 200);
        t.is(res.result, '42');
        t.is(res.headers['content-type'], 'text/csv; charset=utf-8');
        t.is(res.headers['content-disposition'], `${chart.id}.csv`);

        await putData(t.context.server, session, chart, 'fourty two');
        const res2 = await getData(t.context.server, session, chart);
        t.is(res2.statusCode, 200);
        t.is(res2.result, 'fourty two');
        t.is(res2.headers['content-type'], 'text/csv; charset=utf-8');
        t.is(res2.headers['content-disposition'], `${chart.id}.csv`);
    } finally {
        await destroy(chart);
    }
});

test('GET /charts/{id}/data returns an error if chart does not exist', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:read'] });
        const res = await getData(t.context.server, userObj.session, { id: '00000' });
        t.is(res.result.statusCode, 404);
    } finally {
        await destroy(Object.values(userObj));
    }
});
