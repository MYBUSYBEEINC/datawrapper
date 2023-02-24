const test = require('ava');

const {
    V1_BASE_URL,
    createChart,
    createFolder,
    createCharts,
    createUser,
    destroy,
    getChart,
    setup,
    withUser,
    createTeam,
    createPublicChart
} = require('../../../../../services/api/test/helpers/setup.js');
const get = require('lodash/get');
const set = require('lodash/set');
const fs = require('fs');
const tmp = require('tmp');
const FormData = require('form-data');
const streamToPromise = require('stream-to-promise');

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

test.before(async t => {
    t.context.server = await setup();
    t.context.headers = {
        cookie: 'crumb=abc',
        'X-CSRF-Token': 'abc',
        referer: 'http://localhost'
    };
});

test('V1 GET /charts returns charts of a user', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.truthy(json.data.find(el => el.id === charts[0].id));
        t.truthy(json.data.find(el => el.id === charts[1].id));
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?offset=X returns charts offset by X', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        // default order is by last_modified_at DESC
        // so create second chart a bit after first chart
        // to make sure last_modified_at timestamps are different
        await sleep(1);
        charts.push(
            ...(await createCharts([
                {
                    title: 'Chart 2',
                    organization_id: null,
                    author_id: userObj.user.id,
                    last_edit_step: 2
                }
            ]))
        );

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?offset=1`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?filter=q:X returns charts filtered by search query X', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Fool',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?filter=q:Fool`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?filter=folder:X returns charts filtered by folder ID X', async t => {
    let userObj = {};
    let charts = [];
    let folder;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        folder = await createFolder({
            user_id: userObj.user.id
        });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2,
                in_folder: folder.id
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?filter=folder:${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, folder, Object.values(userObj));
    }
});

test('V1 GET /charts?filter=status:published returns published charts', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 4
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?filter=status:published`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?filter=folder:X|status:published returns published charts filtered by folder X', async t => {
    let userObj = {};
    let charts = [];
    let folder;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        folder = await createFolder({
            user_id: userObj.user.id
        });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 4,
                in_folder: folder.id
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 4
            },
            {
                title: 'Chart 2',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2,
                in_folder: folder.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?filter=folder:${folder.id}|status:published`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, folder, Object.values(userObj));
    }
});

test('V1 GET /charts?order=title returns charts ordered by title ascending', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'A',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            },
            {
                title: 'B',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?order=title`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[0].id);
        t.is(json.data[1].id, charts[1].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?order=published_at returns charts ordered by publication date descending', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2,
                published_at: '2021-11-26T12:00:00.000Z'
            },
            {
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2,
                published_at: '2021-11-26T13:00:00.000Z'
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?order=published_at`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?order=status returns charts ordered by last edit step descending', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            },
            {
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 4
            },
            {
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 3
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?order=status`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 3);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[2].id);
        t.is(json.data[2].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?order=created_at returns charts ordered by creation date descending', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        // default order is by last_modified_at DESC
        // so create second chart a bit after first chart
        // to make sure last_modified_at timestamps are different
        await sleep(1);
        charts.push(
            ...(await createCharts([
                {
                    title: 'Chart 2',
                    organization_id: null,
                    author_id: userObj.user.id,
                    last_edit_step: 2
                }
            ]))
        );

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?order=created_at`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('V1 GET /charts?expand=true returns charts containing extra information', async t => {
    let userObj = {};
    let charts = [];
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts?expand=true`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.truthy(json.data[0].author);
        t.truthy(json.data[0].authorId);
        t.truthy(json.data[0].metadata);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test("V1 GET /charts returns an error if user does not have scope 'chart:read'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 POST /charts creates a new chart', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.truthy(json.data[0]);
        chart = await getChart(json.data[0].id);
        t.truthy(chart);
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test("V1 POST /charts returns an error if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 GET /charts/{id} returns chart', async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        const chartId = chart.id;
        t.is(chartId.length, 5);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chartId}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.id.length, 5);
        t.is(json.data.id, chartId);
        t.is(json.data.authorId, chart.author_id);
        t.truthy(json.data.author);
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test("V1 GET /charts/{id} returns an error if user does not have scope 'chart:read'", async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        const chartId = chart.id;
        t.is(chartId.length, 5);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chartId}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 GET /charts/{id} returns an error if chart does not exist', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/00000`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'chart-not-found');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 PUT /charts/{id} can update chart title', async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                title: 'New Title'
            }
        });

        t.is(statusCode, 200);

        await chart.reload();

        t.is(chart.title, 'New Title');

        t.is(json.status, 'ok');
        t.truthy(json.data);
        t.is(json.data.title, 'New Title');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 PUT /charts/{id} replaces entire metadata', async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            organization_id: null,
            author_id: userObj.user.id,
            metadata: {
                describe: {
                    intro: 'hello'
                },
                visualize: {
                    foo: 42
                }
            },
            last_edit_step: 2
        });

        t.is(get(chart.metadata, 'describe.intro'), 'hello');
        t.is(get(chart.metadata, 'visualize.foo'), 42);

        const metadata = {
            visualize: {
                foo: 1
            }
        };

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                metadata
            }
        });

        t.is(statusCode, 200);

        await chart.reload();

        t.is(get(chart.metadata, 'visualize.foo'), 1);
        t.is(get(chart.metadata, 'describe.intro'), undefined);
        t.is(get(chart.metadata, 'describe.source-name'), undefined);

        t.is(json.status, 'ok');
        t.truthy(json.data);
        t.is(get(json.data.metadata, 'visualize.foo'), 1);
        // somehow the old V1 endpoint still returns "virtual default" metadata
        t.is(get(json.data.metadata, 'describe.intro'), '');
        t.is(get(json.data.metadata, 'describe.source-name'), '');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test("V1 PUT /charts/{id} can't update chart title if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                title: 'New Title'
            }
        });

        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 PUT /charts/{id} returns error if chart not exists', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/00000`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                title: 'New Title'
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 PUT /charts/{id} returns error if chart belongs to different user', async t => {
    let userObj1 = {};
    let userObj2 = {};
    let chart = {};
    try {
        userObj1 = await createUser(t.context.server, { role: 'editor' });
        userObj2 = await createUser(t.context.server, { role: 'editor' });

        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj1.user.id,
            last_edit_step: 2
        });

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj2.token}`
            },
            payload: {
                title: 'New Title'
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj1), Object.values(userObj2));
    }
});

test('V1 PUT /charts/{id} can update valid type', async t => {
    let userObj = {};
    let chart = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });

        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2,
            type: 'd3-lines'
        });

        t.is(chart.type, 'd3-lines');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                type: 'd3-bars'
            }
        });

        t.is(statusCode, 200);

        await chart.reload();
        t.is(chart.type, 'd3-bars');

        t.is(json.status, 'ok');
        t.is(json.data.type, 'd3-bars');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 DELETE /charts/{id} can delete a chart', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });

        const chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });
        await chart.reload(); // reload the chart to fetch all attributes
        t.is(chart.deleted, false);

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);

        await chart.reload();
        t.is(chart.deleted, true);

        t.is(json.status, 'ok');
        t.is(json.data, '');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 DELETE /charts/{id} returns error if trying to delete non-existing chart', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/charts/00000`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 DELETE /charts/{id} returns error if chart belongs to different user', async t => {
    let userObj1 = {};
    let userObj2 = {};
    try {
        userObj1 = await createUser(t.context.server, { role: 'editor' });
        userObj2 = await createUser(t.context.server, { role: 'editor' });

        const chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj1.user.id,
            last_edit_step: 2
        });

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj2.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj1), Object.values(userObj2));
    }
});

test("V1 DELETE /charts/{id} can't delete chart if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/charts/${chart.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 POST /charts/{id}/copy returns error for non existing chart copy', async t => {
    return withUser(t.context.server, { role: 'editor' }, async userObj => {
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/00000/copy`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    });
});

test('V1 POST /charts/{id}/copy creates a copy', async t => {
    return withUser(t.context.server, { role: 'editor' }, async userObj => {
        const chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            last_edit_step: 2
        });

        // upload chart data, otherwise PHP /copy fails
        await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: 'hello,world'
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/copy`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);

        t.is(json.status, 'ok');
        t.truthy(json.data);
        t.truthy(json.data.id);

        const copy = await getChart(json.data.id);
        t.truthy(copy);
        t.is(copy.title, 'Chart 1 (Copy)');
        t.is(copy.is_fork, false);
        t.is(copy.forked_from, chart.id);
    });
});

test('V1 POST /charts/{id}/copy does not allow to copy from anyone', async t => {
    return withUser(t.context.server, { role: 'editor' }, async userObj => {
        return withUser(t.context.server, { role: 'editor' }, async userObj2 => {
            const chart = await createChart({
                title: 'Chart 1',
                organization_id: null,
                author_id: userObj.user.id,
                last_edit_step: 2
            });

            // upload chart data, otherwise PHP /copy fails
            await t.context.server.inject({
                method: 'PUT',
                url: `${V1_BASE_URL}/charts/${chart.id}/data`,
                headers: {
                    ...t.context.headers,
                    Authorization: `Bearer ${userObj.token}`,
                    'Content-Type': 'text/csv'
                },
                payload: 'hello,world'
            });

            t.is(chart.title, 'Chart 1');

            const { statusCode, result: json } = await t.context.server.inject({
                method: 'POST',
                url: `${V1_BASE_URL}/charts/${chart.id}/copy`,
                headers: {
                    ...t.context.headers,
                    Authorization: `Bearer ${userObj2.token}`
                }
            });

            t.is(statusCode, 200);
            t.is(json.status, 'error');
            t.is(json.code, 'access-denied');
        });
    });
});

test('V1 GET /charts/{id}/data returns chart data', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:read', 'chart:write']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: JSON.stringify('test data')
        });
        const { statusCode, headers } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.assert(headers['content-type'].includes('text/csv'));
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test("V1 GET /charts/{id}/data returns an error if user does not have scope 'chart:read'", async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        chart = await createChart({
            author_id: userObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 GET /charts/{id}/data returns an error if chart does not exist', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:read'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/00000/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    } finally {
        await destroy(Object.values(userObj));
    }
});
test('V1 GET /charts/{id}/data returns an error if user does not have access to chart', async t => {
    let userObj = {};
    let chart;
    let team;
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:read'] });
        team = await createTeam();
        chart = await createChart({
            organization_id: team.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, team, Object.values(userObj));
    }
});

test('V1 PUT /charts/{id}/data sets the chart data with CSV', async t => {
    let userObj = {};
    let chart;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        const { statusCode } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        const { result: csv } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.assert(csv.includes(expectedCsv)); // the new csv data seems to be prepended with a line break ('\n'), hence the includes check
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 PUT /charts/{id}/data sets the chart data with JSON', async t => {
    let userObj = {};
    let chart;
    const expectedData = {
        test: 'data'
    };
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        const { statusCode } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: expectedData
        });
        t.is(statusCode, 200);
        const { result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.deepEqual(JSON.parse(json), expectedData);
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 PUT /charts/{id}/data even accepts invalid json', async t => {
    let userObj = {};
    let chart;
    const expectedCsv = 'hello, world';
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        const { statusCode } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        const { result: csv } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.assert(csv.includes(expectedCsv)); // the new csv data seems to be prepended with a line break ('\n'), hence the includes check
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test("V1 PUT /charts/{id}/data returns an error if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    let chart;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:read'] });
        chart = await createChart({
            author_id: userObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 PUT /charts/{id}/data returns an error if user cannot access chart', async t => {
    let userObj = {};
    let team;
    let chart;
    const expectedCsv = 'test,data';
    try {
        team = await createTeam();
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:read', 'chart:write']
        });
        chart = await createChart({
            organization_id: team.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, team, Object.values(userObj));
    }
});
test('V1 PUT /charts/{id}/data returns an error if chart does not exist', async t => {
    let userObj = {};
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:write'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/00000/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    } finally {
        await destroy(Object.values(userObj));
    }
});
test.skip('V1 PUT /charts/{id}/data returns an error if chart is a fork', async t => {
    let userObj = {};
    let chart;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:write'] });
        chart = await createChart({
            author_id: userObj.user.id,
            is_fork: true
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'read-only');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test.skip('V1 PUT /charts/{id}/data returns an error if chart metadata custom.webToPrint.mode is print', async t => {
    let userObj = {};
    let chart;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:write'] });
        const metadata = set({}, 'custom.webToPrint.mode', 'print');
        chart = await createChart({
            author_id: userObj.user.id,
            metadata
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`,
                'Content-Type': 'text/csv'
            },
            payload: expectedCsv
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'read-only');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

async function testFileUpload(t, postfix = '.csv') {
    let userObj = {};
    let chart;
    let tmpFile;
    const expectedData = 'test,data';
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync({ postfix });
        fs.writeFileSync(tmpFile.name, expectedData);

        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));

        const { statusCode } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });

        t.is(statusCode, 200);
        const { result: csv } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.assert(csv.includes(expectedData)); // the new csv data seems to be prepended with a line break ('\n'), hence the includes check
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
}

test('V1 POST /charts/{id}/data accepts a .csv file upload', testFileUpload, '.csv');

test('V1 POST /charts/{id}/data accepts a .txt file upload', testFileUpload, '.txt');

test('V1 POST /charts/{id}/data accepts a .tsv file upload', testFileUpload, '.tsv');

test('V1 POST /charts/{id}/data returns an error if no file is uploaded', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });

        const formData = new FormData();
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'upload-error');
        t.is(json.message, 'No files were uploaded.');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 POST /charts/{id}/data returns an error if file with invalid extension is uploaded', async t => {
    let userObj = {};
    let chart;
    let tmpFile;
    const expectedData = 'test,data';
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync({ postfix: '.bla' });
        fs.writeFileSync(tmpFile.name, expectedData);

        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'upload-error');
        t.is(json.message, 'File has an invalid extension, it should be one of txt, csv, tsv.');
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/data returns an error if file with no extension is uploaded', async t => {
    let userObj = {};
    let chart;
    let tmpFile;
    const expectedData = 'test,data';
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync();
        fs.writeFileSync(tmpFile.name, expectedData);

        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'upload-error');
        t.is(json.message, 'File has an invalid extension, it should be one of txt, csv, tsv.');
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/data returns an error if empty file is uploaded', async t => {
    let userObj = {};
    let chart;
    let tmpFile;
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync({ postfix: '.csv' });
        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'upload-error');
        t.is(json.message, 'File is empty');
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/data returns an error if file is too big', async t => {
    let userObj = {};
    let chart;
    let tmpFile;
    try {
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:write', 'chart:read']
        });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync({ postfix: '.csv' });
        fs.writeSync(tmpFile.fd, '0,', 2 * 1024 * 1024);
        fs.closeSync(tmpFile.fd);
        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });

        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'upload-error');
        t.is(json.message, 'File is too large');
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test("V1 POST /charts/{id}/data returns an error if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    let chart;
    let tmpFile;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:read'] });
        chart = await createChart({
            author_id: userObj.user.id
        });
        tmpFile = tmp.fileSync({ postfix: '.csv' });
        fs.writeFileSync(tmpFile.name, expectedCsv);
        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/data returns an error if user cannot access chart', async t => {
    let userObj = {};
    let team;
    let chart;
    let tmpFile;
    const expectedCsv = 'test,data';
    try {
        team = await createTeam();
        userObj = await createUser(t.context.server, {
            role: 'editor',
            scopes: ['chart:read', 'chart:write']
        });
        chart = await createChart({
            organization_id: team.id
        });
        tmpFile = tmp.fileSync({ postfix: '.csv' });
        fs.writeFileSync(tmpFile.name, expectedCsv);
        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(chart, team, Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/data returns an error if chart does not exist', async t => {
    let userObj = {};
    let tmpFile;
    const expectedCsv = 'test,data';
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['chart:write'] });
        tmpFile = tmp.fileSync({ postfix: '.csv' });
        fs.writeFileSync(tmpFile.name, expectedCsv);
        const formData = new FormData();
        formData.append('qqfile', fs.createReadStream(tmpFile.name));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/00000/data`,
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                ...formData.getHeaders()
            },
            payload: await streamToPromise(formData)
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'no-such-chart');
    } finally {
        await destroy(Object.values(userObj));
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('V1 POST /charts/{id}/fork creates a fork', async t => {
    let userObj = {};
    let chart;
    let fork;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createPublicChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: true,
            is_fork: false
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/fork`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.truthy(json.data);
        t.truthy(json.data.id);

        fork = await getChart(json.data.id);
        t.truthy(fork);
        t.is(fork.title, 'Chart 1');
        t.is(fork.is_fork, true);
        t.is(fork.forked_from, chart.id);
    } finally {
        await destroy(fork, chart, Object.values(userObj));
    }
});

test('V1 POST /charts/{id}/fork refuses to create a fork when not forkable', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: false,
            is_fork: false,
            last_edit_step: 5
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/fork`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);

        t.is(json.status, 'error');
        t.is(json.code, 'not-allowed');
        t.is(json.message, 'You can not re-fork a forked chart.');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 POST /charts/{id}/fork refuses to create a fork of forks', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: true,
            is_fork: true,
            last_edit_step: 5
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/fork`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);

        t.is(json.status, 'error');
        t.is(json.code, 'not-allowed');
        t.is(json.message, 'You can not re-fork a forked chart.');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test('V1 POST /charts/{id}/fork refuses to create a fork of unpublished charts', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        chart = await createChart({
            title: 'Chart 1',
            organization_id: null,
            author_id: userObj.user.id,
            forkable: true,
            is_fork: false,
            last_edit_step: 3
        });

        t.is(chart.title, 'Chart 1');

        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/charts/${chart.id}/fork`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });

        t.is(statusCode, 200);

        t.is(json.status, 'error');
        t.is(json.code, 'not-allowed');
        t.is(json.message, 'You can not re-fork a forked chart.');
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});
