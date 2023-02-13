const test = require('ava');
const assign = require('assign-deep');
const { Chart, Folder, UserTeam } = require('@datawrapper/orm/db');
const {
    BASE_URL,
    createCharts,
    createFolders,
    createTeam,
    createTeamWithUser,
    createUser,
    destroy,
    genNonExistentFolderId,
    genRandomChartId,
    setup,
    withChart,
    withTeamWithUser
} = require('../../../test/helpers/setup');
const { randomInt } = require('crypto');
const fetch = require('node-fetch');

function createFolder(props) {
    return Folder.create({
        ...props,
        name: String(randomInt(99999))
    });
}

function findChartById(id) {
    return Chart.findByPk(id);
}

async function addUserToTeam(user, team, role = 'member') {
    await UserTeam.create({
        user_id: user.id,
        organization_id: team.id,
        team_role: role
    });
}

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

test.before(async t => {
    t.context.server = await setup({ usePlugins: false });
    t.context.userObj = await createUser(t.context.server);
    t.context.adminObj = await createUser(t.context.server, { role: 'admin' });
    t.context.teamObj = await createTeamWithUser(t.context.server);
    t.context.auth = {
        strategy: 'session',
        credentials: {
            session: t.context.adminObj.session.id,
            data: t.context.adminObj.session,
            scope: t.context.adminObj.session.scope
        },
        artifacts: t.context.adminObj.user
    };
    t.context.headers = {
        cookie: 'crumb=abc',
        'X-CSRF-Token': 'abc',
        referer: 'http://localhost'
    };
});

test.after.always(async t => {
    await destroy(
        Object.values(t.context.userObj),
        Object.values(t.context.teamObj),
        Object.values(t.context.adminObj)
    );
});

function checkStatusCode(t, code, res, msg) {
    t.is(res.statusCode, code, msg);
    if (res.statusCode !== code) {
        console.error(res.result);
    }
    return res;
}

function getHelpers(t, userObj) {
    if (!userObj) userObj = t.context.adminObj;
    const auth = userObj
        ? {
              strategy: 'session',
              credentials: {
                  session: userObj.session.id,
                  data: userObj.session,
                  scope: userObj.session.scope
              },
              artifacts: userObj.user
          }
        : t.context.auth;
    return {
        user: userObj.user,
        auth,
        async createFolder(folder, expectedCode = 201) {
            return checkStatusCode(
                t,
                expectedCode,
                await t.context.server.inject({
                    method: 'POST',
                    url: '/v3/folders',
                    auth,
                    headers: t.context.headers,
                    payload: folder
                }),
                'createFolder'
            );
        },

        async createChart(chart, expectedCode = 201) {
            return checkStatusCode(
                t,
                expectedCode,
                await t.context.server.inject({
                    method: 'POST',
                    url: '/v3/charts',
                    auth: auth,
                    headers: t.context.headers,
                    payload: assign(
                        {
                            metadata: {
                                axes: [],
                                describe: {},
                                visualize: {},
                                annotate: {}
                            }
                        },
                        chart
                    )
                }),
                'createChart'
            );
        },

        async getCharts(query = '', expectedCode = 200) {
            return checkStatusCode(
                t,
                expectedCode,
                await t.context.server.inject({
                    method: 'GET',
                    url: `/v3/charts${query}`,
                    auth,
                    headers: t.context.headers
                }),
                'getCharts'
            );
        },

        async publishChart(chartId, expectedCode = 200) {
            return checkStatusCode(
                t,
                expectedCode,
                await t.context.server.inject({
                    method: 'POST',
                    url: `/v3/charts/${chartId}/publish`,
                    auth: auth,
                    headers: t.context.headers
                }),
                'publishChart'
            );
        },

        async setActiveTeam(teamId, expectedCode = 200) {
            return checkStatusCode(
                t,
                expectedCode,
                await t.context.server.inject({
                    method: 'PATCH',
                    url: '/v3/me/settings',
                    auth: auth,
                    headers: t.context.headers,
                    payload: {
                        activeTeam: teamId
                    }
                }),
                'setActiveTeam'
            );
        }
    };
}

test('Should be possible to create chart in a folder', async t => {
    const { createChart, createFolder } = getHelpers(t);
    const folder = await createFolder({ name: 'A user folder' });
    const res = await createChart({ folderId: folder.result.id }); // not in folder
    t.is(res.result.folderId, folder.result.id);
});

test('Should be possible to filter by folder id', async t => {
    const { createChart, createFolder, getCharts } = getHelpers(t);
    const folder = await createFolder({ name: 'A user folder' });

    await createChart({ folderId: folder.result.id }); // in folder
    await createChart({ folderId: folder.result.id }); // in folder
    await createChart({ folderId: folder.result.id }); // in folder

    const chartsInFolder = await getCharts(`?folderId=${folder.result.id}`);

    t.is(chartsInFolder.result.total, 3);
});

test('Should be possible to filter by team id', async t => {
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts } = getHelpers(t, teamObj);

    await createChart({ organizationId: team.id });
    await createChart({ organizationId: team.id });
    await createChart({ organizationId: team.id });

    const chartsInTeam = await getCharts(`?teamId=${team.id}`);

    t.is(chartsInTeam.result.total, 3);
});

test('Should be possible to filter by team and folder id', async t => {
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts, createFolder } = getHelpers(t, teamObj);

    // create two charts in team root
    await createChart();
    await createChart();

    const folder = await createFolder({ name: 'A team folder', organizationId: team.id });
    // create one chart in team folder
    await createChart({ folderId: folder.result.id });

    const inTeamFolder = await getCharts(`?teamId=${team.id}&folderId=${folder.result.id}`);
    t.is(inTeamFolder.result.total, 1);

    const inTeamRoot = await getCharts(`?teamId=${team.id}&folderId=null`);
    t.is(inTeamRoot.result.total, 2);

    const inTeamTotal = await getCharts(`?teamId=${team.id}`);
    t.is(inTeamTotal.result.total, 3);
});

test('Should be possible to filter by folder id null', async t => {
    const { createChart, getCharts, createFolder } = getHelpers(t);
    const folder = await createFolder({ name: 'A user folder' });

    await createChart(); // not in folder
    const { total: chartsNotInFolder } = (await getCharts(`?folderId=null`)).result;
    await createChart({ folderId: folder.result.id }); // in folder
    await createChart({ folderId: folder.result.id }); // in folder

    const { total: chartsNotInFolderAfter } = (await getCharts(`?folderId=null`)).result;
    t.is(chartsNotInFolder, chartsNotInFolderAfter);
});

test('Cannot filter by folder a user does not have access to', async t => {
    const admin = getHelpers(t);
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const teamUser = getHelpers(t, teamObj);
    // admin creates a folder
    const folder = (await admin.createFolder({ name: 'Admins only' })).result;
    // admin creates a chart
    await admin.createChart({ folderId: folder.id });
    // normal team user tries to filter charts
    await teamUser.getCharts(`?folderId=${folder.id}`, 403);
});

test('Cannot filter by team a user does not have access to', async t => {
    const teamObj1 = await createTeamWithUser(t.context.server, { role: 'member' });
    const teamUser1 = getHelpers(t, teamObj1);
    const teamObj2 = await createTeamWithUser(t.context.server, { role: 'member' });
    const teamUser2 = getHelpers(t, teamObj2);

    // team user can query their own team
    await teamUser1.getCharts(`?teamId=${teamObj1.team.id}`, 200);
    await teamUser2.getCharts(`?teamId=${teamObj2.team.id}`, 200);
    // but not the other ones
    await teamUser1.getCharts(`?teamId=${teamObj2.team.id}`, 403);
    await teamUser2.getCharts(`?teamId=${teamObj1.team.id}`, 403);
});

test('Cannot combine by folderId with different teamId', async t => {
    const admin = getHelpers(t);
    const teamObj1 = await createTeamWithUser(t.context.server, { role: 'member' });
    const teamUser1 = getHelpers(t, teamObj1);
    const folder1 = (
        await teamUser1.createFolder({ name: 'team1', organizationId: teamObj1.team.id })
    ).result;

    const teamObj2 = await createTeamWithUser(t.context.server, { role: 'member' });

    // can query folder
    await admin.getCharts(`?folderId=${folder1.id}`, 200);
    // can query folder combined with correct team
    await admin.getCharts(`?folderId=${folder1.id}&teamId=${teamObj1.team.id}`, 200);
    // cannot query folder combined with different team
    await admin.getCharts(`?folderId=${folder1.id}&teamId=${teamObj2.team.id}`, 403);
});

test('Users can create charts in a team they have access to', async t => {
    let teamObj = {};
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team } = teamObj;
        const { createChart } = getHelpers(t, teamObj);

        const chart = await createChart({
            organizationId: team.id
        });

        t.is(chart.statusCode, 201);
    } finally {
        await destroy(...Object.values(teamObj));
    }
});

test('Users can create charts with settings set', async t => {
    let teamObj = {};
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team, session } = teamObj;

        const chart = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost'
            },
            payload: {
                organizationId: team.id,
                title: 'My new visualization',
                type: 'd3-bars',
                metadata: {
                    axes: [],
                    describe: {
                        intro: 'A description',
                        byline: ''
                    }
                }
            }
        });

        t.is(chart.statusCode, 201);
        t.is(chart.result.type, 'd3-bars');
        t.is(chart.result.title, 'My new visualization');
        t.is(chart.result.metadata.describe.intro, 'A description');
        t.is(chart.result.metadata.describe.byline, '');
    } finally {
        await destroy(...Object.values(teamObj));
    }
});

test('Users can create a chart in a team when authenticating with a token', async t => {
    let teamObj = {};
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team, token } = teamObj;

        const chart = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                Authorization: `Bearer ${token}`
            },
            payload: {
                organizationId: team.id,
                title: 'My new visualization',
                type: 'd3-bars'
            }
        });
        t.is(chart.statusCode, 201);
        t.is(chart.result.type, 'd3-bars');
        t.is(chart.result.title, 'My new visualization');
        t.is(chart.result.organizationId, team.id);
    } finally {
        await destroy(...Object.values(teamObj));
    }
});

test('Users cannot create a chart with an invalid token', async t => {
    let teamObj = {};
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team } = teamObj;

        const chart = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                Authorization: `Bearer XXXXXXXXX`
            },
            payload: {
                organizationId: team.id,
                title: 'My new visualization',
                type: 'd3-bars'
            }
        });
        t.is(chart.statusCode, 401);
    } finally {
        await destroy(...Object.values(teamObj));
    }
});

test('Users cannot create chart in a team they dont have access to (token auth)', async t => {
    let userObj = {};
    let teamObj = {};
    try {
        userObj = await createUser(t.context.server);
        const { token } = userObj;
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team } = teamObj;

        const chart = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                Authorization: `Bearer ${token}`
            },
            payload: {
                organizationId: team.id
            }
        });

        t.is(chart.statusCode, 403);
    } finally {
        await destroy(...Object.values(userObj), ...Object.values(teamObj));
    }
});

test('Users cannot create chart in a team they dont have access to (session auth)', async t => {
    let userObj = {};
    let teamObj = {};
    try {
        userObj = await createUser(t.context.server);
        const { session } = userObj;
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        const { team } = teamObj;

        const chart = await t.context.server.inject({
            method: 'POST',
            url: '/v3/charts',
            headers: {
                cookie: `DW-SESSION=${session.id}; crumb=abc`,
                'X-CSRF-Token': 'abc',
                referer: 'http://localhost'
            },
            payload: {
                organizationId: team.id
            }
        });

        t.is(chart.statusCode, 403);
    } finally {
        if (userObj) {
            await destroy(...Object.values(userObj));
        }
        if (teamObj) {
            await destroy(...Object.values(teamObj));
        }
    }
});

test('Charts can be sorted by title', async t => {
    // create a new team for an empty slare
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts } = getHelpers(t, teamObj);

    await createChart({ title: 'Zoo', organizationId: team.id });
    await createChart({ title: 'Boo', organizationId: team.id });
    await createChart({ title: 'Foo', organizationId: team.id });

    const { list: charts } = (await getCharts(`?teamId=${team.id}&orderBy=title&order=ASC`)).result;
    t.is(charts.length, 3);
    t.is(charts[0].title, 'Boo');
    t.is(charts[1].title, 'Foo');
    t.is(charts[2].title, 'Zoo');
});

test('Charts can be sorted by createdAt', async t => {
    // create a new team for an empty slare
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts } = getHelpers(t, teamObj);

    const c0 = await createChart({ organizationId: team.id });
    await sleep(1);
    const c1 = await createChart({ organizationId: team.id });
    await sleep(1);
    const c2 = await createChart({ organizationId: team.id });

    const { list: charts } = (await getCharts(`?teamId=${team.id}&orderBy=createdAt`)).result;
    t.is(charts.length, 3);
    // default sort is DESC
    t.is(charts[0].id, c2.result.id);
    t.is(charts[1].id, c1.result.id);
    t.is(charts[2].id, c0.result.id);
});

test('Charts can be sorted by publishedAt', async t => {
    // create a new team for an empty slate
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts, publishChart } = getHelpers(t, teamObj);

    const c0 = await createChart({ organizationId: team.id });
    const c1 = await createChart({ organizationId: team.id });
    const c2 = await createChart({ organizationId: team.id });

    await publishChart(c1.result.id);
    await sleep(1);
    await publishChart(c2.result.id);
    await sleep(1);
    await publishChart(c0.result.id);

    const { list: charts } = (await getCharts(`?teamId=${team.id}&orderBy=publishedAt&order=ASC`))
        .result;
    t.is(charts.length, 3);
    t.is(charts[0].id, c1.result.id);
    t.is(charts[1].id, c2.result.id);
    t.is(charts[2].id, c0.result.id);
});

test('Charts can be filtered by lastEditStep', async t => {
    // create a new team for an empty slate
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const { createChart, getCharts } = getHelpers(t, teamObj);

    await createChart({ organizationId: team.id });
    await createChart({ organizationId: team.id, lastEditStep: 1 });
    await createChart({ organizationId: team.id, lastEditStep: 2 });
    await createChart({ organizationId: team.id, lastEditStep: 3 });
    await createChart({ organizationId: team.id, lastEditStep: 4 });

    const { total: noFilter } = (await getCharts(`?teamId=${team.id}`)).result;
    const { total: filter1 } = (await getCharts(`?teamId=${team.id}&minLastEditStep=1`)).result;
    const { total: filter2 } = (await getCharts(`?teamId=${team.id}&minLastEditStep=2`)).result;
    const { total: filter3 } = (await getCharts(`?teamId=${team.id}&minLastEditStep=3`)).result;
    const { total: filter4 } = (await getCharts(`?teamId=${team.id}&minLastEditStep=4`)).result;
    const { total: filter5 } = (await getCharts(`?teamId=${team.id}&minLastEditStep=5`)).result;

    t.is(noFilter, 5);
    t.is(filter1, 4);
    t.is(filter2, 3);
    t.is(filter3, 2);
    t.is(filter4, 1);
    t.is(filter5, 0);
});

test('Charts list goes through all user and team charts', async t => {
    // create a new team for an empty slare
    const teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
    const { team } = teamObj;

    const admin = getHelpers(t);
    const user1 = getHelpers(t, teamObj);

    // user 1 creates 2 team charts
    await user1.createChart();
    await user1.createChart();
    // user 1 creates 3 private charts
    await user1.setActiveTeam(null);
    await user1.createChart();
    await user1.createChart();
    await user1.createChart();

    // another team user also creates some charts
    const teamObj2 = await teamObj.addUser('member');
    const user2 = getHelpers(t, teamObj2);
    // user 2 created 3 team charts
    await user2.createChart();
    await user2.createChart();
    await user2.createChart();
    // and one private chart
    await user2.setActiveTeam(null);
    await user2.createChart();

    // user 1 sees 8 charts (3 private + 5 team)
    const u1 = (await user1.getCharts()).result;
    t.is(u1.total, 8);

    // user 2 sees 6 charts (1 private + 5 team)
    const u2 = (await user2.getCharts()).result;
    t.is(u2.total, 6);

    // user 1 sees 5 self-created charts (3 private + 2 team)
    const m1 = (await user1.getCharts('?authorId=me')).result;
    t.is(m1.total, 5);

    // user 1 sees 5 self-created charts (3 private + 2 team)
    const m1a = (await user1.getCharts('?authorId=me&teamId=null')).result;
    t.is(m1a.total, 3);

    // user 2 sees 4 self-created charts (1 private + 3 team)
    const m2 = (await user2.getCharts('?authorId=me')).result;
    t.is(m2.total, 4);

    // an admin can see all 5 team charts without being in the team
    const a = (await admin.getCharts(`?teamId=${team.id}`)).result;
    t.is(a.total, 5);
});

test('User cannot query charts by different user', async t => {
    // create two users
    const admin = getHelpers(t);
    const user1 = getHelpers(t, await createUser(t.context.server));
    const user2 = getHelpers(t, await createUser(t.context.server));
    // user 1 creates a chart
    await user1.createChart();
    // user 1 may query it
    const u1 = (await user1.getCharts(`?authorId=${user1.user.id}`)).result;
    t.is(u1.total, 1);
    // admins may query it
    const a = (await admin.getCharts(`?authorId=${user1.user.id}`)).result;
    t.is(a.total, 1);
    // but user 2 may not
    await user2.getCharts(`?authorId=${user1.user.id}`, 403);
});

test('Admins can not query charts from non-existing users', async t => {
    // create two users
    const admin = getHelpers(t);
    await admin.getCharts(`?authorId=12345678`, 404);
});

test('Admins can not query charts from non-existing teams', async t => {
    // create two users
    const admin = getHelpers(t);
    await admin.getCharts(`?teamId=xxxxxxx`, 404);
});

test('POST /charts returns an error when an unknown chart type is set', async t => {
    const res = await t.context.server.inject({
        method: 'POST',
        url: '/v3/charts',
        auth: t.context.auth,
        headers: t.context.headers,
        payload: {
            type: 'spam'
        }
    });
    t.is(res.statusCode, 400);
});

test('PATCH /charts moves multiple charts to different folder of same user', async t => {
    let charts;
    let folder;
    try {
        const { user, token } = t.context.teamObj;
        folder = await createFolder({
            user_id: user.id
        });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: folder.id
                }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 2);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        t.truthy(result0);
        t.truthy(result1);
        t.is(result0.folderId, folder.id);
        t.is(result0.organizationId, null);
        t.is(result1.folderId, folder.id);
        t.is(result1.organizationId, null);
        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, folder.id);
        t.is(chart1.organization_id, null);
        const chart2 = await findChartById(charts[1].id);
        t.is(chart2.in_folder, folder.id);
        t.is(chart2.organization_id, null);
    } finally {
        await destroy(charts, folder);
    }
});

test('PATCH /charts moves multiple charts from a user into root folder of a team', async t => {
    let charts;
    let userFolders;
    let userObj = {};
    let team;
    try {
        userObj = await createUser(t.context.server);
        const { user, token } = userObj;
        userFolders = await createFolders([
            {
                user_id: user.id
            },
            {
                user_id: user.id
            }
        ]);
        team = await createTeam();
        await addUserToTeam(user, team);
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: userFolders[0].id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: userFolders[1].id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    teamId: team.id,
                    folderId: null
                }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 2);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        t.truthy(result0);
        t.truthy(result1);
        t.is(result0.folderId, null);
        t.is(result0.organizationId, team.id);
        t.is(result1.folderId, null);
        t.is(result1.organizationId, team.id);
        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, null);
        t.is(chart1.organization_id, team.id);
        const chart2 = await findChartById(charts[1].id);
        t.is(chart2.in_folder, null);
        t.is(chart2.organization_id, team.id);
    } finally {
        await destroy(charts, userFolders, ...Object.values(userObj), team);
    }
});

test('PATCH /charts moves multiple charts from a user into folder of a team', async t => {
    let charts;
    let teamFolder;
    let team;
    let userFolders;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server);
        const { user, token } = userObj;
        userFolders = await createFolders([
            {
                user_id: user.id
            },
            {
                user_id: user.id
            }
        ]);
        team = await createTeam();
        await addUserToTeam(user, team);
        teamFolder = await createFolder({ org_id: team.id });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: userFolders[0].id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: userFolders[1].id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: teamFolder.id,
                    teamId: team.id
                }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 2);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        t.truthy(result0);
        t.truthy(result1);
        t.is(result0.folderId, teamFolder.id);
        t.is(result0.organizationId, team.id);
        t.is(result0.authorId, user.id);
        t.is(result1.folderId, teamFolder.id);
        t.is(result1.organizationId, team.id);
        t.is(result1.authorId, user.id);
        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, teamFolder.id);
        t.is(chart1.organization_id, team.id);
        t.is(chart1.author_id, user.id);
        const chart2 = await findChartById(charts[1].id);
        t.is(chart2.in_folder, teamFolder.id);
        t.is(chart2.organization_id, team.id);
        t.is(chart2.author_id, user.id);
    } finally {
        await destroy(charts, teamFolder, team, userFolders, ...Object.values(userObj));
    }
});

test('PATCH /charts moves multiple charts from a team into the root folder of a user', async t => {
    let charts;
    let team;
    let otherUserObj;
    let teamFolders;
    try {
        otherUserObj = await createUser(t.context.server, { role: 'editor' });
        const { user: otherUser } = otherUserObj;
        const { token, user } = t.context.userObj;
        team = await createTeam();
        await addUserToTeam(user, team);
        await addUserToTeam(otherUser, team);
        teamFolders = await createFolders([
            {
                org_id: team.id
            },
            {
                org_id: team.id
            }
        ]);
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: otherUser.id,
                in_folder: teamFolders[0].id,
                organization_id: team.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: teamFolders[1].id,
                organization_id: team.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: null }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 2);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        t.truthy(result0);
        t.truthy(result1);
        t.is(result0.folderId, null);
        t.is(result0.authorId, user.id);
        t.is(result0.organizationId, null);
        t.is(result1.folderId, null);
        t.is(result1.authorId, user.id);
        t.is(result1.organizationId, null);
        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, null);
        t.is(chart1.organization_id, null);
        t.is(chart1.author_id, user.id);
        const chart2 = await findChartById(charts[1].id);
        t.is(chart2.in_folder, null);
        t.is(chart2.organization_id, null);
        t.is(chart2.author_id, user.id);
    } finally {
        await destroy(charts, teamFolders, Object.values(otherUserObj));
    }
});

test('PATCH /charts overwrites chart team with folder team', async t => {
    let charts;
    let folderTeam;
    let teamFolder;
    let otherUserObj;

    try {
        otherUserObj = await createUser(t.context.server, { role: 'editor' });
        const { user: otherUser } = otherUserObj;
        const { token, team, user } = t.context.teamObj;
        folderTeam = await createTeam();
        await addUserToTeam(user, folderTeam);
        teamFolder = await createFolder({ org_id: folderTeam.id });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: otherUser.id,
                organization_id: team.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: teamFolder.id }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 1);
        t.is(result[0].id, charts[0].id);
        t.is(result[0].folderId, teamFolder.id);
        t.is(result[0].organizationId, folderTeam.id);
        t.is(result[0].authorId, user.id);
        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, teamFolder.id);
        t.is(chart1.organization_id, folderTeam.id);
        t.is(chart1.author_id, user.id);
    } finally {
        await destroy(charts, teamFolder, folderTeam, Object.values(otherUserObj));
    }
});

test('PATCH /charts moves multiple charts to a folder of a team', async t => {
    let charts;
    let teamObj1 = {};
    let teamObj2 = {};
    let userObj = {};
    let team1Folder;
    let team2Folder;
    try {
        teamObj1 = await createTeamWithUser(t.context.server);
        teamObj2 = await createTeamWithUser(t.context.server);
        userObj = await createUser(t.context.server);
        // user1 is only in team1
        const { user: user1, team: team1 } = teamObj1;
        // user2 is in team1 and team2
        const { user: user2, team: team2, token: token2 } = teamObj2;
        // user3 is in team1 and team2
        const { user: user3 } = userObj;

        await addUserToTeam(user2, team1);
        await addUserToTeam(user3, team1);
        await addUserToTeam(user3, team2);

        team1Folder = await createFolder({ org_id: team1.id });
        team2Folder = await createFolder({ org_id: team2.id });

        charts = await createCharts([
            {
                author_id: user1.id,
                organization_id: team1.id,
                folder_id: team1Folder.folder_id
            },
            {
                author_id: user2.id,
                organization_id: null
            },
            {
                author_id: user3.id,
                organization_id: team1.id
            }
        ]);
        // user2 moves charts to team2
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token2}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: team2Folder.id
                }
            }
        });
        t.is(res.statusCode, 200);
        const result = res.result;
        t.is(result.length, 3);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        const result2 = result.find(el => el.id === charts[2].id);
        t.truthy(result0);
        t.truthy(result1);
        t.truthy(result2);

        // this chart previously belonged to user1, but since user1 is not in team2
        // it now belongs to user2
        t.is(result0.authorId, user2.id);
        // user2 still owns this chart
        t.is(result1.authorId, user2.id);
        // user3 still owns this chart
        t.is(result2.authorId, user3.id);

        // all charts now in team2
        t.is(result0.organizationId, team2.id);
        t.is(result1.organizationId, team2.id);
        t.is(result2.organizationId, team2.id);

        for (const chart of charts) {
            const updatedChart = await findChartById(chart.id);
            t.is(updatedChart.in_folder, team2Folder.id);
            t.is(updatedChart.organization_id, team2.id);
            if (chart.author_id === user3.id) {
                t.is(updatedChart.author_id, user3.id);
            } else {
                t.is(updatedChart.author_id, user2.id);
            }
        }
    } finally {
        await destroy(
            charts,
            team1Folder,
            team2Folder,
            ...Object.values(teamObj1),
            ...Object.values(teamObj2),
            ...Object.values(userObj)
        );
    }
});

test('PATCH /charts returns an error if the specified folder does not belong to the specified team', async t => {
    let charts;
    let teamFolders;
    let teams;
    try {
        const { token, user } = t.context.userObj;
        teams = [await createTeam(), await createTeam()];
        await addUserToTeam(user, teams[0]);
        await addUserToTeam(user, teams[1]);
        teamFolders = [
            await createFolder({ org_id: teams[0].id }),
            await createFolder({ org_id: teams[1].id })
        ];
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: teamFolders[0].id,
                    teamId: teams[1].id
                }
            }
        });
        t.is(res.statusCode, 403);
    } finally {
        await destroy(charts, teamFolders, teams);
    }
});

test('PATCH /charts returns an error if a user does not have scope chart:write', async t => {
    let charts;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { scopes: ['spam'] });
        const { token, user } = userObj;
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: null }
            }
        });
        t.is(res.statusCode, 403);
    } finally {
        await destroy(charts, ...Object.values(userObj));
    }
});

test('PATCH /charts returns an error if one of the charts does not exist', async t => {
    let charts;
    let userFolder;
    try {
        const { token, user } = t.context.userObj;
        userFolder = await createFolder({ user_id: user.id });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: [charts[0].id, genRandomChartId()],
                patch: { folderId: userFolder.id }
            }
        });
        t.is(res.statusCode, 404);
    } finally {
        await destroy(charts, userFolder);
    }
});

test('PATCH /charts returns an error if the specified folder does not exist', async t => {
    let charts;
    try {
        const { token, user } = t.context.userObj;
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: genNonExistentFolderId() }
            }
        });
        t.is(res.statusCode, 404);
    } finally {
        await destroy(charts);
    }
});

test('PATCH /charts returns an error if the user does not have access to a chart', async t => {
    let anotherUserObj = {};
    let charts;
    try {
        const { token, user } = t.context.userObj;
        anotherUserObj = await createUser(t.context.server);
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: anotherUserObj.user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: null }
            }
        });
        t.is(res.statusCode, 404);
    } finally {
        await destroy(...Object.values(anotherUserObj), charts);
    }
});

test('PATCH /charts returns an error if the user does not have access to a folder', async t => {
    let anotherFolder;
    let anotherUserObj = {};
    let charts;
    let userFolder;
    try {
        const { token, user } = t.context.userObj;
        userFolder = await createFolder({ user_id: user.id });
        anotherUserObj = await createUser(t.context.server);
        anotherFolder = await createFolder({ user_id: anotherUserObj.user.id });
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: anotherFolder.id }
            }
        });
        t.is(res.statusCode, 403);
    } finally {
        await destroy(anotherFolder, Object.values(anotherUserObj), charts, userFolder);
    }
});

test('PATCH /charts returns an error if admin tries to move chart to team which author does not have access to, and the target team has no owner', async t => {
    let charts;
    let teamObj1 = {};
    let teamObj2 = {};
    let adminUserObj = {};
    let team1Folder;
    try {
        teamObj1 = await createTeamWithUser(t.context.server, { role: 'member' });
        teamObj2 = await createTeamWithUser(t.context.server);
        adminUserObj = await createUser(t.context.server, { role: 'admin' });
        const { user: user1, team: team1 } = teamObj1;
        const { user: user2, team: team2 } = teamObj2;
        const { token: adminToken } = adminUserObj;

        team1Folder = await createFolder({ org_id: team1.id });

        charts = await createCharts([
            {
                author_id: user1.id,
                organization_id: team1.id,
                in_folder: null
            },
            {
                author_id: user2.id,
                organization_id: team2.id,
                in_folder: null
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: team1Folder.folder_id
                }
            }
        });
        // request fails
        t.is(res.statusCode, 400);
        // charts remain unchanged
        for (const originalChart of charts) {
            const chart = await findChartById(originalChart.id);
            t.is(chart.in_folder, originalChart.in_folder);
            t.is(chart.author_id, originalChart.author_id);
            t.is(chart.organization_id, originalChart.organization_id);
        }
    } finally {
        await destroy(
            charts,
            team1Folder,
            ...Object.values(teamObj1),
            ...Object.values(teamObj2),
            ...Object.values(adminUserObj)
        );
    }
});

test('PATCH /charts returns an error if the user does not have access to a team', async t => {
    let anotherTeam;
    let charts = [];
    try {
        const { token, user } = t.context.teamObj;
        anotherTeam = await createTeam();
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: null, teamId: anotherTeam.id }
            }
        });
        t.is(res.statusCode, 403);
    } finally {
        await destroy(anotherTeam, charts);
    }
});

test('PATCH /charts returns an error if the specified team does not exist', async t => {
    let charts = [];
    try {
        const { token, user } = t.context.teamObj;
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: { folderId: null, teamId: 'non-existent' }
            }
        });
        t.is(res.statusCode, 403);
    } finally {
        await destroy(charts);
    }
});

test('PATCH /charts returns an error if trying to update any other chart property', async t => {
    let charts;
    try {
        const { token, user } = t.context.userObj;
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: null,
                    title: 'New Chart 2'
                }
            }
        });
        t.is(res.statusCode, 400);
    } finally {
        await destroy(charts);
    }
});

test('PATCH /charts moves charts to a team correctly', async t => {
    let charts;
    let teamObj1 = {};
    let teamObj2 = {};
    let teamFolder = {};
    let userObj = {};
    try {
        teamObj1 = await createTeamWithUser(t.context.server);
        teamObj2 = await createTeamWithUser(t.context.server);
        userObj = await createUser(t.context.server);

        const { user: user1, team: team1 } = teamObj1;
        const { user: user2, team: team2, token: token2 } = teamObj2;
        const { user: user3 } = userObj;

        // user2 is in both teams
        await addUserToTeam(user2, team1);
        // user3 is in both teams
        await addUserToTeam(user3, team1);
        await addUserToTeam(user3, team2);

        teamFolder = await createFolder({
            user_id: null,
            org_id: team1.id
        });

        charts = await createCharts([
            {
                author_id: user1.id,
                organization_id: team1.id
            },
            {
                author_id: user2.id,
                folder_id: teamFolder.folder_id,
                organization_id: team1.id
            },
            {
                author_id: user2.id,
                organization_id: null
            },
            {
                author_id: user3.id,
                organization_id: team1.id
            }
        ]);

        // user2 moves charts to team2
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token2}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    teamId: team2.id,
                    folderId: null
                }
            }
        });

        t.is(res.statusCode, 200);
        const result = res.result;
        t.is(result.length, 4);

        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        const result2 = result.find(el => el.id === charts[2].id);
        const result3 = result.find(el => el.id === charts[3].id);

        t.truthy(result0);
        t.truthy(result1);
        t.truthy(result2);
        t.truthy(result3);

        t.is(result0.folderId, null);
        t.is(result1.folderId, null);
        t.is(result2.folderId, null);
        t.is(result3.folderId, null);

        // all charts now in team2
        t.is(result0.organizationId, team2.id);
        t.is(result1.organizationId, team2.id);
        t.is(result2.organizationId, team2.id);
        t.is(result3.organizationId, team2.id);

        // charts originally belonging to user2 still do
        t.is(result0.authorId, user2.id);
        t.is(result1.authorId, user2.id);
        // chart belonging to user1, who cannot access team2, now belongs to user2, since user2 made the request
        t.is(result2.authorId, user2.id);
        // chart belonging to user3, who can access team2, still belongs to user3
        t.is(result3.authorId, user3.id);

        for (const chart of charts) {
            const updated = await findChartById(chart.id);
            t.is(updated.in_folder, null);
            t.is(updated.organization_id, team2.id);
            if (chart.author_id === user3.id) {
                t.is(updated.author_id, user3.id);
            } else {
                t.is(updated.author_id, user2.id);
            }
        }
    } finally {
        await destroy(
            charts,
            teamFolder,
            ...Object.values(userObj),
            ...Object.values(teamObj1),
            ...Object.values(teamObj2)
        );
    }
});

test('PATCH /charts moves multiple charts to a different folder of the same team', async t => {
    let charts;
    let team;
    let teamFolders;
    let userObj = {};
    let otherUserObj = {};
    try {
        userObj = await createUser(t.context.server);
        otherUserObj = await createUser(t.context.server);
        const { user, token } = userObj;
        const { user: otherUser } = otherUserObj;
        team = await createTeam();
        await addUserToTeam(user, team);
        await addUserToTeam(otherUser, team);
        teamFolders = await createFolders([
            {
                user_id: null,
                org_id: team.id
            },
            {
                user_id: null,
                org_id: team.id
            }
        ]);
        charts = await createCharts([
            {
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: otherUser.id,
                in_folder: teamFolders[0].id,
                organization_id: team.id
            },
            {
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: user.id,
                in_folder: teamFolders[0].id,
                organization_id: team.id
            }
        ]);
        const res = await t.context.server.inject({
            method: 'PATCH',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                ids: charts.map(c => c.id),
                patch: {
                    folderId: teamFolders[1].id,
                    teamId: team.id
                }
            }
        });
        t.is(res.statusCode, 200);
        const result = await res.result;
        t.is(result.length, 2);
        const result0 = result.find(el => el.id === charts[0].id);
        const result1 = result.find(el => el.id === charts[1].id);
        t.truthy(result0);
        t.truthy(result1);
        t.is(result0.folderId, teamFolders[1].id);
        t.is(result0.organizationId, team.id);
        t.is(result0.authorId, otherUser.id);

        t.is(result1.folderId, teamFolders[1].id);
        t.is(result1.organizationId, team.id);
        t.is(result1.authorId, user.id);

        const chart1 = await findChartById(charts[0].id);
        t.is(chart1.in_folder, teamFolders[1].id);
        t.is(chart1.organization_id, team.id);
        t.is(chart1.author_id, otherUser.id);

        const chart2 = await findChartById(charts[1].id);
        t.is(chart2.in_folder, teamFolders[1].id);
        t.is(chart2.organization_id, team.id);
        t.is(chart2.author_id, user.id);
    } finally {
        await destroy(
            charts,
            teamFolders,
            team,
            Object.values(userObj),
            Object.values(otherUserObj)
        );
    }
});

test('PATCH /charts moves a chart with empty language', async t => {
    await withTeamWithUser(t.context.server, {}, async ({ team, token, user }) => {
        await withChart(
            {
                author_id: user.id,
                language: ''
            },
            async chart => {
                const res = await t.context.server.inject({
                    method: 'PATCH',
                    url: '/v3/charts',
                    headers: {
                        ...t.context.headers,
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    payload: {
                        ids: [chart.id],
                        patch: {
                            folderId: null,
                            teamId: team.id
                        }
                    }
                });
                t.is(res.statusCode, 200);
            }
        );
    });
});

test('GET /charts?expand=true returns charts containing extra information', async t => {
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
        const res = await t.context.server.inject({
            method: 'GET',
            url: '/v3/charts?expand=true',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.list.length, 1);
        t.truthy(json.list[0].author);
        t.truthy(json.list[0].authorId);
        t.truthy(json.list[0].metadata);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('GET /charts returns charts containing author info', async t => {
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
        const res = await t.context.server.inject({
            method: 'GET',
            url: '/v3/charts',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.list.length, 1);
        t.truthy(json.list[0].author);
        t.truthy(json.list[0].authorId);
        const author = json.list[0].author;
        t.truthy(author.name);
        t.truthy(author.email);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts returns charts of a user', async t => {
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
        const res = await fetch(`${BASE_URL}/charts`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.truthy(json.data.find(el => el.id === charts[0].id));
        t.truthy(json.data.find(el => el.id === charts[1].id));
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?offset=X returns charts offset by X', async t => {
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

        const res = await fetch(`${BASE_URL}/charts?offset=1`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?filter=q:X returns charts filtered by search query X', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?filter=q:Fool`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?filter=folder:X returns charts filtered by folder ID X', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?filter=folder:${folder.id}`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, folder, Object.values(userObj));
    }
});

test('PHP GET /charts?filter=status:published returns published charts', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?filter=status:published`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?filter=folder:X|status:published returns published charts filtered by folder X', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?filter=folder:${folder.id}|status:published`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.is(json.data[0].id, charts[0].id);
    } finally {
        await destroy(charts, folder, Object.values(userObj));
    }
});

test('PHP GET /charts?order=title returns charts ordered by title ascending', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?order=title`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[0].id);
        t.is(json.data[1].id, charts[1].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?order=published_at returns charts ordered by publication date descending', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?order=published_at`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?order=status returns charts ordered by last edit step descending', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?order=status`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 3);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[2].id);
        t.is(json.data[2].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?order=created_at returns charts ordered by creation date descending', async t => {
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

        const res = await fetch(`${BASE_URL}/charts?order=created_at`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 2);
        t.is(json.data[0].id, charts[1].id);
        t.is(json.data[1].id, charts[0].id);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test('PHP GET /charts?expand=true returns charts containing extra information', async t => {
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
        const res = await fetch(`${BASE_URL}/charts?expand=true`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.truthy(json.data[0].author);
        t.truthy(json.data[0].authorId);
        t.truthy(json.data[0].metadata);
    } finally {
        await destroy(charts, Object.values(userObj));
    }
});

test("PHP GET /charts returns an error if user does not have scope 'chart:read'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const res = await fetch(`${BASE_URL}/charts`, {
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 403);
        const json = await res.json();
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('PHP POST /charts creates a new chart', async t => {
    let userObj = {};
    let chart;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        const res = await fetch(`${BASE_URL}/charts`, {
            method: 'POST',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 200);
        const json = await res.json();
        t.is(json.status, 'ok');
        t.is(json.data.length, 1);
        t.truthy(json.data[0]);
        chart = await findChartById(json.data[0].id);
        t.truthy(chart);
    } finally {
        await destroy(chart, Object.values(userObj));
    }
});

test("PHP POST /charts returns an error if user does not have scope 'chart:write'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const res = await fetch(`${BASE_URL}/charts`, {
            method: 'POST',
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.status, 403);
        const json = await res.json();
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});
