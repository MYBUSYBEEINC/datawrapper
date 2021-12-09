const test = require('ava');
const {
    setup,
    destroy,
    createThemes,
    createTeamWithUser,
    createUser,
    createTeam
} = require('../../../test/helpers/setup');

const defaultHeaders = {
    cookie: 'crumb=abc',
    'X-CSRF-Token': 'abc',
    referer: 'http://localhost'
};

test.before(async t => {
    t.context.server = await setup({ usePlugins: true });
    t.context.config = t.context.server.methods.config();
});

async function addThemeToTeam(theme, team) {
    const { TeamTheme } = require('@datawrapper/orm/models');

    await TeamTheme.create({
        organization_id: team.id,
        theme_id: theme.id
    });
}

async function addUserToTeam(user, team, role = 'member') {
    const { UserTeam } = require('@datawrapper/orm/models');

    await UserTeam.create({
        user_id: user.id,
        organization_id: team.id,
        team_role: role
    });
}

test('GET /themes returns all themes of a user', async t => {
    let themes;
    let teamObj = {};
    try {
        const defaultThemeIds = t.context.config.general.defaultThemes;
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], teamObj.team);
        await addThemeToTeam(themes[1], teamObj.team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        const expectedThemeIds = [...defaultThemeIds, ...themes.map(e => e.id)];
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.total, expectedThemeIds.length);
        t.is(json.list.length, expectedThemeIds.length);
        expectedThemeIds.forEach(id => {
            t.assert(json.list.find(el => el.id === id));
        });
    } finally {
        await destroy(themes, Object.values(teamObj));
    }
});

test('GET /themes returns themes correctly paginated', async t => {
    let themes;
    let team;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        team = await createTeam({
            settings: {
                restrictDefaultThemes: true
            }
        });
        await addUserToTeam(userObj.user, team);
        const alphabet = Array.from(Array(26).keys()).map(n => String.fromCharCode(65 + n));
        themes = await createThemes(alphabet.map(letter => ({ title: `Theme ${letter}` })));
        for (const theme of themes) {
            await addThemeToTeam(theme, team);
        }

        const testPagination = async (offset, limit, expectedThemes) => {
            const res = await t.context.server.inject({
                method: 'GET',
                url: `/v3/themes?offset=${offset}&limit=${limit}`,
                headers: {
                    ...defaultHeaders,
                    Authorization: `Bearer ${userObj.token}`
                }
            });
            const expectedList = expectedThemes.slice(offset, offset + limit);
            t.is(res.statusCode, 200);
            const json = await res.result;
            t.is(json.total, expectedThemes.length);
            t.is(json.list.length, expectedList.length);
            expectedList.forEach(theme => {
                t.assert(json.list.find(el => el.id === theme.id));
            });
        };
        await testPagination(0, 10, themes); // expected [A...J]
        await testPagination(10, 10, themes); // expected [K...T]
        await testPagination(20, 10, themes); // expected [U...Z]
        await testPagination(30, 10, themes); // expected []
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test('GET /themes returns error if offset is negative', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes?offset=-1`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 400);
        const json = await res.result;
        t.is(json.error, 'Bad Request');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('GET /themes returns error if limit is negative', async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes?limit=-1`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 400);
        const json = await res.result;
        t.is(json.error, 'Bad Request');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('GET /themes does not return themes of teams a user is not part of', async t => {
    let themes;
    let userObj = {};
    let team;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        team = await createTeam();
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 200);
        const json = await res.result;
        themes.forEach(theme => {
            t.assert(!json.list.find(el => el.id === theme.id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test('GET /themes does not return all existing themes to an admin user', async t => {
    let themes;
    let userObj = {};
    let team;
    try {
        const defaultThemeIds = t.context.config.general.defaultThemes;
        userObj = await createUser(t.context.server, { role: 'admin' });
        team = await createTeam();
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.total, defaultThemeIds.length);
        t.is(json.list.length, defaultThemeIds.length);
        defaultThemeIds.forEach(id => {
            t.assert(json.list.find(el => el.id === id));
        });
        themes.forEach(theme => {
            t.assert(!json.list.find(el => el.id === theme.id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test('GET /themes does not return default themes if team has restricted default themes', async t => {
    let themes;
    let team;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        team = await createTeam({
            settings: {
                restrictDefaultThemes: true
            }
        });
        await addUserToTeam(userObj.user, team);
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        const expectedThemeIds = [...themes.map(e => e.id)];
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.total, expectedThemeIds.length);
        t.is(json.list.length, expectedThemeIds.length);
        expectedThemeIds.forEach(id => {
            t.assert(json.list.find(el => el.id === id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test("GET /themes returns an error if user does not have scope 'theme:read'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 403);
        const json = await res.result;
        t.is(json.message, 'Insufficient scope');
    } finally {
        await destroy(Object.values(userObj));
    }
});

test('V1 GET /themes returns all themes of a user', async t => {
    let themes;
    let teamObj = {};
    try {
        const defaultThemeIds = t.context.config.general.defaultThemes;
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], teamObj.team);
        await addThemeToTeam(themes[1], teamObj.team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/api-v1/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${teamObj.token}`
            }
        });
        const expectedThemeIds = [...defaultThemeIds, ...themes.map(e => e.id)];
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.status, 'ok');
        t.is(json.data.length, expectedThemeIds.length);
        expectedThemeIds.forEach(id => {
            t.assert(json.data.find(el => el.id === id));
        });
    } finally {
        await destroy(themes, Object.values(teamObj));
    }
});

test('V1 GET /themes does not return themes of teams a user is not part of', async t => {
    let themes;
    let userObj = {};
    let team;
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        team = await createTeam();
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/api-v1/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.status, 'ok');
        themes.forEach(theme => {
            t.assert(!json.data.find(el => el.id === theme.id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test('V1 GET /themes returns all themes for admins', async t => {
    let themes;
    let userObj = {};
    let team;
    try {
        const defaultThemeIds = t.context.config.general.defaultThemes;
        userObj = await createUser(t.context.server, { role: 'admin' });
        team = await createTeam();
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/api-v1/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        const expectedThemeIds = [...defaultThemeIds, ...themes.map(e => e.id)];
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.status, 'ok');
        t.assert(json.data.length >= expectedThemeIds.length);
        expectedThemeIds.forEach(theme => {
            t.assert(!json.data.find(el => el.id === theme.id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test('V1 GET /themes does not return default themes if team has restricted default themes', async t => {
    let themes;
    let team;
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor' });
        team = await createTeam({
            settings: {
                restrictDefaultThemes: true
            }
        });
        await addUserToTeam(userObj.user, team);
        themes = await createThemes([{ title: 'Theme 1' }, { title: 'Theme 2' }]);
        await addThemeToTeam(themes[0], team);
        await addThemeToTeam(themes[1], team);
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/api-v1/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        const expectedThemeIds = [...themes.map(e => e.id)];
        t.is(res.statusCode, 200);
        const json = await res.result;
        t.is(json.status, 'ok');
        t.is(json.data.length, expectedThemeIds.length);
        expectedThemeIds.forEach(id => {
            t.assert(json.data.find(el => el.id === id));
        });
    } finally {
        await destroy(themes, team, Object.values(userObj));
    }
});

test("V1 GET /themes returns an error if user does not have scope 'theme:read'", async t => {
    let userObj = {};
    try {
        userObj = await createUser(t.context.server, { role: 'editor', scopes: ['scope:invalid'] });
        const res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/api-v1/themes`,
            headers: {
                ...defaultHeaders,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(res.statusCode, 403);
        const json = await res.result;
        t.is(json.status, 'error');
        t.is(json.code, 'access-denied');
    } finally {
        await destroy(Object.values(userObj));
    }
});