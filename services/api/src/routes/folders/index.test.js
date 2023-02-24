const { serial: test } = require('ava');
const { randomInt } = require('crypto');
const {
    createUser,
    destroy,
    setup,
    createTeamWithUser,
    createCharts,
    createFolders,
    createFoldersWithParent
} = require('../../../test/helpers/setup');

test.before(async t => {
    t.context.server = await setup({ usePlugins: false });
    t.context.adminObj = await createUser(t.context.server, { role: 'admin' });
    t.context.teamObj = await createTeamWithUser(t.context.server);
    t.context.auth = {
        strategy: 'session',
        credentials: t.context.teamObj.session,
        artifacts: t.context.teamObj.user
    };
    t.context.headers = {
        cookie: 'crumb=abc',
        'X-CSRF-Token': 'abc',
        referer: 'http://localhost'
    };
});

test.after.always(async t => {
    await destroy(...Object.values(t.context.teamObj), ...Object.values(t.context.adminObj));
});

async function createTestCharts(t) {
    let folders = await createFolders([
        { name: 'Test Folder' },
        { name: 'User Folder', user_id: t.context.teamObj.user.id },
        { name: 'Team Folder', org_id: t.context.teamObj.team.id }
    ]);
    const nestedFolders = await createFoldersWithParent(
        [{ name: 'Nested Folder', user_id: t.context.teamObj.user.id }],
        folders[1]
    );
    folders = [...folders, ...nestedFolders];
    const charts = await createCharts([
        // one chars in user root folder
        {
            id: String(randomInt(99999)),
            title: 'user root chart',
            theme: 'theme1',
            type: 'bar',
            metadata: {},
            author_id: t.context.teamObj.user.id
        },
        // one chart in organization root folder
        {
            id: String(randomInt(99999)),
            title: 'org root chart',
            theme: 'theme1',
            type: 'bar',
            metadata: {},
            organization_id: t.context.teamObj.team.id
        },
        // one chart in user sub folder
        {
            id: String(randomInt(99999)),
            title: 'user folder chart',
            theme: 'theme1',
            type: 'bar',
            metadata: {},
            author_id: t.context.teamObj.user.id,
            in_folder: folders[1].id
        },
        // one chart in org sub folder
        {
            id: String(randomInt(99999)),
            title: 'org folder chart',
            theme: 'theme1',
            type: 'bar',
            metadata: {},
            in_folder: folders[2].id,
            organization_id: t.context.teamObj.team.id
        },
        // one chart in nested user folder
        {
            id: String(randomInt(99999)),
            title: 'user nested folder chart',
            theme: 'theme1',
            type: 'bar',
            metadata: {},
            author_id: t.context.teamObj.user.id,
            in_folder: folders[3].id
        }
    ]);
    return () => destroy(charts, folders.reverse()); // reverse so that nested folders are destroyed first
}

test('GET /folders should return all folders of a user', async t => {
    let cleanup;
    try {
        cleanup = await createTestCharts(t);

        const resp = await t.context.server.inject({
            method: 'GET',
            url: '/v3/folders',
            auth: t.context.auth
        });

        t.is(resp.statusCode, 200);
        t.is(resp.result.total, 2);

        const foldersAndChartsOfUser = resp.result.list.find(el => el.type === 'user');
        t.is(foldersAndChartsOfUser.folders.length, 1);
        t.is(foldersAndChartsOfUser.charts.length, 1);
        t.is(foldersAndChartsOfUser.charts[0].title, 'user root chart');
        t.is(foldersAndChartsOfUser.folders[0].folders.length, 1);
        t.is(foldersAndChartsOfUser.folders[0].charts.length, 1);
        t.is(foldersAndChartsOfUser.folders[0].charts[0].title, 'user folder chart');
        t.is(foldersAndChartsOfUser.folders[0].folders[0].charts.length, 1);
        t.is(
            foldersAndChartsOfUser.folders[0].folders[0].charts[0].title,
            'user nested folder chart'
        );
        t.is(foldersAndChartsOfUser.charts[0].metadata, undefined); // check that chart data is cleaned
        t.is(foldersAndChartsOfUser.folders[0].charts.length, 1);

        const foldersAndChartsOfTeam = resp.result.list.find(el => el.type === 'team');
        t.is(foldersAndChartsOfTeam.charts.length, 1);
        t.is(foldersAndChartsOfTeam.folders.length, 1);
        t.is(foldersAndChartsOfTeam.charts[0].title, 'org root chart');
        t.is(foldersAndChartsOfTeam.folders[0].charts[0].title, 'org folder chart');
    } finally {
        if (cleanup) await cleanup();
    }
});

test('GET /folders?compact returns chart counts', async t => {
    let cleanup;
    try {
        cleanup = await createTestCharts(t);

        const resp = await t.context.server.inject({
            method: 'GET',
            url: '/v3/folders?compact',
            auth: t.context.auth
        });

        t.is(resp.statusCode, 200);
        t.is(resp.result.total, 2);

        const foldersAndChartsOfUser = resp.result.list.find(el => el.type === 'user');
        t.is(foldersAndChartsOfUser.charts, 1);
        t.is(foldersAndChartsOfUser.folders[0].charts, 1);

        const foldersAndChartsOfTeam = resp.result.list.find(el => el.type === 'team');
        t.is(foldersAndChartsOfTeam.charts, 1);
        t.is(foldersAndChartsOfTeam.folders[0].charts, 1);
    } finally {
        if (cleanup) await cleanup();
    }
});
