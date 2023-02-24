const test = require('ava');

const {
    V1_BASE_URL,
    createTeamWithUser,
    createUser,
    destroy,
    setup,
    createTeam,
    createCharts,
    addUserToTeam
} = require('../../../../../services/api/test/helpers/setup.js');

test.before(async t => {
    t.context.server = await setup();
    t.context.headers = {
        cookie: 'crumb=abc',
        'X-CSRF-Token': 'abc',
        referer: 'http://localhost'
    };
});

test('V1 GET /teams/{id}/charts returns charts of a team', async t => {
    let teamObj = {};
    let otherTeam;
    let charts = [];
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        otherTeam = await createTeam();
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: teamObj.team.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: otherTeam.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${teamObj.team.id}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.total, 1);
        t.is(json.data.charts.length, 1);
        t.is(json.data.charts[0].id, charts[0].id);
        t.is(json.data.page, 0);
        t.is(json.data.numPages, 1);
    } finally {
        await destroy(charts, otherTeam, Object.values(teamObj));
    }
});

test('V1 GET /teams/{id}/charts returns only charts with data', async t => {
    let teamObj = {};
    let otherTeam;
    let charts = [];
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        otherTeam = await createTeam();
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: teamObj.team.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 0,
                organization_id: teamObj.team.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${teamObj.team.id}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.total, 1);
        t.is(json.data.charts.length, 1);
        t.is(json.data.charts[0].id, charts[0].id);
        t.is(json.data.page, 0);
        t.is(json.data.numPages, 1);
    } finally {
        await destroy(charts, otherTeam, Object.values(teamObj));
    }
});

test('V1 GET /teams/{id}/charts returns charts of a team for admin users', async t => {
    let team;
    let otherTeam;
    let charts = [];
    let adminObj = {};
    try {
        team = await createTeam();
        otherTeam = await createTeam();
        adminObj = await createUser(t.context.server, { role: 'admin' });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: team.id
            },
            {
                title: 'Chart 3',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: otherTeam.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${team.id}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${adminObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.total, 1);
        t.is(json.data.charts.length, 1);
        t.is(json.data.charts[0].id, charts[0].id);
        t.is(json.data.page, 0);
        t.is(json.data.numPages, 1);
    } finally {
        await destroy(charts, otherTeam, team, Object.values(adminObj));
    }
});

async function testV1GetTeamChartsWithInsufficientScope(t, scopes) {
    let userObj = {};
    let team;
    try {
        team = await createTeam();
        userObj = await createUser(t.context.server, { scopes });
        await addUserToTeam(userObj.user, team);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${team.id}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
        t.is(json.message, 'Insufficient scope');
    } finally {
        await destroy(team, Object.values(userObj));
    }
}

test(
    'V1 GET /teams/{id}/charts returns error if user does not have scope team:read',
    testV1GetTeamChartsWithInsufficientScope,
    ['chart:read']
);

test(
    'V1 GET /teams/{id}/charts returns error if user does not have scope chart:read',
    testV1GetTeamChartsWithInsufficientScope,
    ['team:read']
);

test('V1 GET /teams/{id}/charts returns error if non-admin user is not part of the team', async t => {
    let userObj = {};
    let team;
    try {
        team = await createTeam();
        userObj = await createUser(t.context.server, { scopes: ['chart:read', 'team:read'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${team.id}/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(team, Object.values(userObj));
    }
});

test('V1 GET /teams/{id}/charts returns error if the team does not exist', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { scopes: ['chart:read', 'team:read'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/spam/charts`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});

async function testV1GetTeamChartsPaginated(t, page, expectedNoOfCharts) {
    let teamObj = {};
    let otherTeam;
    let charts = [];
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        otherTeam = await createTeam();
        charts = await createCharts(
            // create 50 charts --> page size in V1 is 48
            Array.from(Array(50).keys()).map(key => ({
                title: `Chart ${key}`,
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                last_edit_step: 1,
                organization_id: teamObj.team.id
            }))
        );
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${teamObj.team.id}/charts?page=${page}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.total, charts.length);
        t.is(json.data.charts.length, expectedNoOfCharts);
        t.is(json.data.page, page.toString());
        t.is(json.data.numPages, 2);
    } finally {
        await destroy(charts, otherTeam, Object.values(teamObj));
    }
}

test(
    'V1 GET /teams/{id}/charts returns charts of a team correctly paginated (page 1)',
    testV1GetTeamChartsPaginated,
    0,
    48
);

test(
    'V1 GET /teams/{id}/charts returns charts of a team correctly paginated (page 2)',
    testV1GetTeamChartsPaginated,
    1,
    2
);

test('V1 GET /teams/{id}/charts?search=X searches in team charts', async t => {
    let teamObj = {};
    let charts = [];
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        charts = await createCharts([
            {
                last_edit_step: 1,
                author_id: teamObj.user.id,
                organization_id: teamObj.team.id
            },
            {
                title: 'foo',
                last_edit_step: 1,
                author_id: teamObj.user.id,
                organization_id: teamObj.team.id
            },
            {
                last_edit_step: 1,
                author_id: teamObj.user.id,
                organization_id: teamObj.team.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/${teamObj.team.id}/charts?search=foo`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.total, 1);
        t.is(json.data.charts.length, 1);
        t.is(json.data.charts[0].id, charts[1].id);
        t.is(json.data.page, 0);
        t.is(json.data.numPages, 1);
    } finally {
        await destroy(charts, Object.values(teamObj));
    }
});

test('V1 GET /teams/user returns teams of a user', async t => {
    let userObj = {};
    let team1;
    let team2;
    let team3;
    try {
        team1 = await createTeam();
        team2 = await createTeam();
        team3 = await createTeam();
        userObj = await createUser(t.context.server);
        await addUserToTeam(userObj.user, team1);
        await addUserToTeam(userObj.user, team2);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/user`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data.includes(team1.id), true);
        t.is(json.data.includes(team2.id), true);
        t.is(json.data.includes(team3.id), false);
    } finally {
        await destroy(team1, team2, team3, Object.values(userObj));
    }
});

test('V1 GET /teams/user does not return disabled teams of a user', async t => {
    const disableTeam = async team => {
        // helper function to disable a team. Uses a raw query
        // since property 'disabled' is not part of the Sequelize model definition
        const db = t.context.server.methods.getDB();
        await db.query('UPDATE organization SET disabled = 1 WHERE id = ?', {
            replacements: [team.id],
            type: db.QueryTypes.UPDATE
        });
    };
    let userObj = {};
    let team1;
    let team2;
    try {
        team1 = await createTeam();
        team2 = await createTeam();
        await disableTeam(team2);
        userObj = await createUser(t.context.server);
        await addUserToTeam(userObj.user, team1);
        await addUserToTeam(userObj.user, team2);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/user`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data.includes(team1.id), true);
        t.is(json.data.includes(team2.id), false);
    } finally {
        await destroy(team1, team2, Object.values(userObj));
    }
});

test("V1 GET /teams/user returns an error if user does not have scope 'team:read'", async t => {
    let userObj = {};
    let team1;
    let team2;
    let team3;
    try {
        team1 = await createTeam();
        team2 = await createTeam();
        team3 = await createTeam();
        userObj = await createUser(t.context.server, { scopes: ['scope:invalid'] });
        await addUserToTeam(userObj.user, team1);
        await addUserToTeam(userObj.user, team2);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/teams/user`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
        t.is(json.message, 'Insufficient scope');
    } finally {
        await destroy(team1, team2, team3, Object.values(userObj));
    }
});
