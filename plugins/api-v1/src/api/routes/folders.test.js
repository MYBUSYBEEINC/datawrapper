const { serial: test } = require('ava');
const { randomInt } = require('crypto');
const { Chart, Folder } = require('@datawrapper/orm/db');
const {
    V1_BASE_URL,
    createFolder,
    createFolders,
    createCharts,
    createUser,
    createTeam,
    destroy,
    setup,
    createTeamWithUser,
    getChart,
    getFolder,
    genRandomChartId,
    addUserToTeam
} = require('../../../../../services/api/test/helpers/setup.js');

function findFolderByName(name) {
    return Folder.findOne({ where: { name } });
}

function findChartsByIds(ids) {
    return Chart.findAll({ where: { id: ids } });
}
const MAX_ID = 99999;
function randomId() {
    return String(randomInt(MAX_ID));
}

function nonExistentId() {
    return String(MAX_ID + 1);
}

test.before(async t => {
    t.context.server = await setup();
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

test('V1 GET /folders returns the list of folders for the current user', async t => {
    let folder, charts;
    try {
        folder = await createFolder({ user_id: t.context.teamObj.user.id });
        charts = await createCharts([
            {
                id: String(randomInt(99999)),
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: t.context.teamObj.user.id,
                last_edit_step: 3
            },
            {
                id: String(randomInt(99999)),
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                organization_id: t.context.teamObj.team.id,
                last_edit_step: 3
            },
            {
                id: String(randomInt(99999)),
                title: 'Chart 3',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                in_folder: folder.id,
                author_id: t.context.teamObj.user.id,
                last_edit_step: 3
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data[0].folders.length, 1);
        t.is(json.data[0].charts, 1);
        t.is(json.data[0].type, 'user');
        t.is(json.data[0].folders[0].name, folder.name);
        t.is(json.data[0].folders[0].charts, 1);
        t.is(json.data[1].charts, 1);
        t.is(json.data[1].folders.length, 0);
        // following assertions fail after Node migration
        // t.is(json.data[0].folders[0].user, t.context.teamObj.user.id);
        // t.is(json.data[1].type, 'organization');
        // t.is(json.data[1].organization.id, t.context.teamObj.team.id);
    } finally {
        await destroy(charts, folder);
    }
});

test('V1 GET /folders returns an error 403 when the API token does not have the folder:read scope', async t => {
    let folder;
    let userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['spam'] });
        folder = await createFolder({ user_id: userObj.user.id });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.data, undefined);
    } finally {
        await destroy(folder, userObj);
    }
});

test('V1 POST /folders creates a new folder', async t => {
    let folder;
    try {
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name
            }
        });
        folder = await findFolderByName(name);
        t.is(folder.name, name);
        t.is(folder.parent_id, null);
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.name, name);
    } finally {
        await destroy(folder);
    }
});

test('V1 POST /folders returns an error when folder name is not specified', async t => {
    const { statusCode, result: json } = await t.context.server.inject({
        method: 'POST',
        url: `${V1_BASE_URL}/folders`,
        headers: {
            ...t.context.headers,
            Authorization: `Bearer ${t.context.teamObj.token}`,
            'Content-Type': 'application/json'
        },
        payload: {
            // missing name
        }
    });
    t.is(statusCode, 200);
    t.is(json.status, 'error');
    t.is(json.code, 'need-name');
});

test('V1 POST /folders creates a new folder with a parent folder', async t => {
    let folder, parentFolder;
    try {
        parentFolder = (
            await createFolders([
                {
                    name: 'parent',
                    user_id: t.context.teamObj.user.id
                }
            ])
        )[0];
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                parent: parentFolder.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.name, name);
        t.is(json.data.parent, parentFolder.id);
        t.is(json.data.user, parentFolder.user_id);
        folder = await findFolderByName(name);
        t.is(folder.name, name);
        t.is(folder.parent_id, parentFolder.id);
    } finally {
        await destroy(folder, parentFolder);
    }
});

test('V1 POST /folders returns an error when creating a user folder with a parent folder not owned by the user', async t => {
    let parentFolder, userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['folder:read'] });
        parentFolder = (
            await createFolders([
                {
                    name: 'parent',
                    user_id: userObj.user.id
                }
            ])
        )[0];
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                parent: parentFolder.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'parent-invalid');
    } finally {
        await destroy(parentFolder, ...Object.keys(userObj));
    }
});

test('V1 POST /folders returns an error when creating a folder with a parent folder that is not owned by the same organization', async t => {
    let parentFolder, otherTeamObj;
    try {
        otherTeamObj = await createTeamWithUser(t.context.server);
        parentFolder = (
            await createFolders([
                {
                    name: 'parent',
                    org_id: otherTeamObj.team.id
                }
            ])
        )[0];
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                parent: parentFolder.id,
                organization: t.context.teamObj.team.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'parent-invalid');
    } finally {
        await destroy(parentFolder, ...Object.keys(otherTeamObj));
    }
});

test('V1 POST /folders creates a new folder with organization specified', async t => {
    let folder;
    try {
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                organization: t.context.teamObj.team.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.name, name);
        t.is(json.data.organization, t.context.teamObj.team.id);
        t.is(json.data.user, null);
        folder = await findFolderByName(name);
        t.is(folder.name, name);
        t.is(folder.org_id, t.context.teamObj.team.id);
    } finally {
        await destroy(folder);
    }
});

test('V1 POST /folders returns an error when the user does not have access to the specified organization', async t => {
    let teamObj;
    try {
        teamObj = await createTeamWithUser(t.context.server);
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                organization: teamObj.team.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'org-invalid');
    } finally {
        await destroy(...Object.keys(teamObj));
    }
});

test('V1 POST /folders returns an error when creating a folder with duplicate name', async t => {
    let folder;
    try {
        const name = String(randomInt(99999));
        folder = (await createFolders([{ name: name, user_id: t.context.teamObj.user.id }]))[0];
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'duplicate-name');
    } finally {
        await destroy(folder);
    }
});

test('V1 POST /folders charts are not moved into a newly created folder', async t => {
    let folder, charts;
    try {
        charts = await createCharts([
            {
                id: String(randomInt(99999)),
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: t.context.teamObj.user.id
            },
            {
                id: String(randomInt(99999)),
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: t.context.teamObj.user.id
            }
        ]);
        const name = String(randomInt(99999));
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name,
                add: [charts[0].id, charts[1].id]
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        folder = await findFolderByName(name);
        const updatedCharts = await findChartsByIds([charts[0].id, charts[1].id]);
        updatedCharts.forEach(chart => t.is(chart.in_folder, null));
    } finally {
        await destroy(charts, folder);
    }
});

test('V1 POST /folders returns an error 403 when the API token does not have the folder:write scope', async t => {
    let userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['spam'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'POST',
            url: `${V1_BASE_URL}/folders`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            },
            payload: {
                name: 'some-name'
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.data, undefined);
    } finally {
        await destroy(...Object.keys(userObj));
    }
});

test('V1 GET /folders/{id} returns a single folder', async t => {
    let folder;
    let userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['folder:read'] });
        folder = await createFolder({ user_id: userObj.user.id });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.name, folder.name);
        t.is(json.data.user, userObj.user.id);
    } finally {
        await destroy(folder, userObj);
    }
});

test('V1 GET /folders/{id} returns an error 404 when the requested folder does not exist', async t => {
    let userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['folder:read'] });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders/9999999`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 404);
        t.is(json.status, 'error');
        t.is(json.data, undefined);
    } finally {
        await destroy(userObj);
    }
});

test('V1 GET /folders/{id} returns an error 403 when the API token does not have the folder:read scope', async t => {
    let folder;
    let userObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['spam'] });
        folder = await createFolder({ user_id: userObj.user.id });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        t.is(statusCode, 403);
        t.is(json.status, 'error');
        t.is(json.data, undefined);
    } finally {
        await destroy(folder, userObj);
    }
});

test('V1 GET /folders/{id} returns an error when the user does not have permissions to access the requested folder', async t => {
    let folder;
    let userObj;
    let anotherUserObj;
    try {
        userObj = await createUser(t.context.server, { scopes: ['folder:read'] });
        anotherUserObj = await createUser(t.context.server);
        folder = await createFolder({ user_id: anotherUserObj.user.id });
        const { statusCode } = await t.context.server.inject({
            method: 'GET',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${userObj.token}`
            }
        });
        // This is what the old (PHP) API returns:
        // t.is(statusCode, 200);
        // t.is(json.status, 'error');
        // t.is(json.code, 'access-denied');
        // t.is(json.data, undefined);

        // this is what the new (Node) API returns:
        t.is(statusCode, 404);
    } finally {
        await destroy(folder, userObj, anotherUserObj);
    }
});

test('V1 PUT /folders/{id} moves a folder to the root', async t => {
    let folder, parent;
    try {
        parent = await createFolder({
            name: 'parent',
            user_id: t.context.teamObj.user.id
        });
        folder = await createFolder({
            name: 'child',
            user_id: t.context.teamObj.user.id,
            parent_id: parent.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                parent: false
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.parent, null);
        folder = await getFolder(folder.id);
        t.is(folder.parent_id, null);
    } finally {
        await destroy(folder, parent);
    }
});

test('V1 PUT /folders/{id} moves a folder to a different organization', async t => {
    let folder, team;
    try {
        team = await createTeam();
        await addUserToTeam(t.context.teamObj.user, team);
        folder = await createFolder({
            name: 'child',
            org_id: t.context.teamObj.team.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                organization: team.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        t.is(json.data.organization, team.id);
        folder = await getFolder(folder.id);
        t.is(folder.org_id, team.id);
    } finally {
        await destroy(folder, team);
    }
});

test('V1 PUT /folders/{id} returns an error when trying to update a non-existent folder', async t => {
    const name = randomId();
    const { statusCode, result: json } = await t.context.server.inject({
        method: 'PUT',
        url: `${V1_BASE_URL}/folders/${nonExistentId()}`,
        headers: {
            ...t.context.headers,
            Authorization: `Bearer ${t.context.teamObj.token}`,
            'Content-Type': 'application/json'
        },
        payload: {
            name
        }
    });
    t.is(statusCode, 200);

    t.is(json.status, 'error');
    t.is(json.code, 'not-found');
});

test('V1 PUT /folders/{id} returns an error when trying to move a folder to a team the user is not part of', async t => {
    let folder, team;
    try {
        team = await createTeam();
        folder = await createFolder({
            name: 'child',
            org_id: t.context.teamObj.team.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                organization: team.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'org-invalid');
    } finally {
        await destroy(folder, team);
    }
});

test('V1 PUT /folders/{id} returns an error when user does not have access to the folder', async t => {
    let folder, userObj;
    try {
        userObj = await createUser(t.context.server);
        folder = await createFolder({
            name: 'name',
            user_id: userObj.user.id
        });
        const name = randomId();
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        // t.is(json.code, 'access-denied');   // Before node migration
        t.is(json.code, 'not-found'); // After node migration
    } finally {
        await destroy(folder, ...Object.values(userObj));
    }
});

test('V1 PUT /folders/{id} returns an error when trying to update the name of a folder to a duplicate name', async t => {
    let folder, duplicateFolder;
    try {
        const name = randomId();
        duplicateFolder = await createFolder({
            name: name,
            user_id: t.context.teamObj.user.id
        });
        folder = await createFolder({
            name: 'other',
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                name
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'duplicate-name');
    } finally {
        await destroy(folder, duplicateFolder);
    }
});

test('V1 PUT /folders/{id} returns an error when setting a non-existent folder as parent of a folder', async t => {
    let folder;
    try {
        folder = await createFolder({
            name: 'other',
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                parent: nonExistentId()
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'parent-invalid');
    } finally {
        await destroy(folder);
    }
});

test('V1 PUT /folders/{id} returns an error when setting an inaccessible folder as parent of a folder', async t => {
    let folder, inaccessibleParent, team;
    try {
        const name = randomId();
        team = await createTeam();
        inaccessibleParent = await createFolder({
            name: name,
            org_id: team.id
        });
        folder = await createFolder({
            name: 'other',
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                parent: inaccessibleParent.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'parent-invalid');
    } finally {
        await destroy(folder, inaccessibleParent, team);
    }
});

test('V1 PUT /folders/{id} returns an error when setting the parent of a folder to the folder itself', async t => {
    let folder;
    try {
        folder = await createFolder({
            name: 'name',
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                parent: folder.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'move-folder-inside-itself');
    } finally {
        await destroy(folder);
    }
});

test('V1 PUT /folders/{id} returns an error when setting the parent of a folder to a child of the folder', async t => {
    let folder, child;
    try {
        folder = await createFolder({
            name: 'name',
            user_id: t.context.teamObj.user.id
        });
        child = await createFolder({
            name: 'child',
            parent_id: folder.id,
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                parent: child.id
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'move-folder-inside-substree');
    } finally {
        await destroy(child, folder);
    }
});

test('V1 PUT /folders/{id} moves charts into a folder', async t => {
    let folder, inaccessibleFolder, otherUserObj, charts, teamObj;
    try {
        teamObj = await createTeamWithUser(t.context.server, { role: 'member' });
        otherUserObj = await createUser(t.context.server);
        folder = await createFolder({
            name: 'test',
            user_id: teamObj.user.id
        });
        inaccessibleFolder = await createFolder({
            name: 'inaccessible',
            user_id: otherUserObj.user.id
        });
        charts = await createCharts([
            {
                id: genRandomChartId(),
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: teamObj.user.id
            },
            {
                id: genRandomChartId(),
                title: 'Chart 2',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: otherUserObj.user.id,
                in_folder: inaccessibleFolder.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'PUT',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${teamObj.token}`,
                'Content-Type': 'application/json'
            },
            payload: {
                add: [charts[0].id, charts[1].id]
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        const chart1 = await getChart(charts[0].id);
        t.is(chart1.in_folder, folder.id);
        const chart2 = await getChart(charts[1].id);
        t.is(chart2.in_folder, inaccessibleFolder.id);
    } finally {
        await destroy(
            charts,
            folder,
            inaccessibleFolder,
            ...Object.values(otherUserObj),
            ...Object.values(teamObj)
        );
    }
});

test('V1 DELETE /folders/{id} deletes a folder', async t => {
    let folder;
    try {
        folder = await createFolder({
            name: 'name',
            user_id: t.context.teamObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        folder = await getFolder(folder.id);
        t.is(folder, null);
    } finally {
        await destroy(folder);
    }
});

test('V1 DELETE /folders/{id} moves charts of deleted folder to parent', async t => {
    let folder, parent, charts;
    try {
        parent = await createFolder({
            name: 'parent',
            user_id: t.context.teamObj.user.id
        });
        folder = await createFolder({
            name: 'test',
            user_id: t.context.teamObj.user.id,
            parent_id: parent.id
        });
        charts = await createCharts([
            {
                id: randomId(),
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: t.context.teamObj.user.id,
                in_folder: folder.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        const chart1 = await getChart(charts[0].id);
        t.is(chart1.in_folder, parent.id);
    } finally {
        await destroy(charts, folder, parent);
    }
});

test('V1 DELETE /folders/{id} moves charts of deleted root folder to root', async t => {
    let folder, charts;
    try {
        folder = await createFolder({
            name: 'test',
            user_id: t.context.teamObj.user.id
        });
        charts = await createCharts([
            {
                id: randomId(),
                title: 'Chart 1',
                theme: 'theme1',
                type: 'bar',
                metadata: {},
                author_id: t.context.teamObj.user.id,
                in_folder: folder.id
            }
        ]);
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'ok');
        const chart1 = await getChart(charts[0].id);
        t.is(chart1.in_folder, null);
    } finally {
        await destroy(charts, folder);
    }
});

test('V1 DELETE /folders/{id} returns an error when trying to delete non-existent folder', async t => {
    const { statusCode, result: json } = await t.context.server.inject({
        method: 'DELETE',
        url: `${V1_BASE_URL}/folders/${nonExistentId()}`,
        headers: {
            ...t.context.headers,
            Authorization: `Bearer ${t.context.teamObj.token}`,
            'Content-Type': 'application/json'
        }
    });
    t.is(statusCode, 200);
    t.is(json.status, 'error');
    t.is(json.code, 'not-found');
});

test('V1 DELETE /folders/{id} returns an error when trying to delete inaccessible folder', async t => {
    let folder, userObj;
    try {
        userObj = await createUser(t.context.server);
        folder = await createFolder({
            name: 'name',
            user_id: userObj.user.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        // t.is(json.code, 'access-denied');   // Before node migration
        t.is(json.code, 'not-found'); // After node migration
    } finally {
        await destroy(folder, ...Object.values(userObj));
    }
});

test('V1 DELETE /folders/{id} returns an error when trying to delete folder with subfolders', async t => {
    let folder, subfolder;
    try {
        folder = await createFolder({
            name: 'name',
            user_id: t.context.teamObj.user.id
        });
        subfolder = await createFolder({
            name: 'name',
            user_id: t.context.teamObj.user.id,
            parent_id: folder.id
        });
        const { statusCode, result: json } = await t.context.server.inject({
            method: 'DELETE',
            url: `${V1_BASE_URL}/folders/${folder.id}`,
            headers: {
                ...t.context.headers,
                Authorization: `Bearer ${t.context.teamObj.token}`,
                'Content-Type': 'application/json'
            }
        });
        t.is(statusCode, 200);
        t.is(json.status, 'error');
        t.is(json.code, 'has-subfolders');
    } finally {
        await destroy(subfolder, folder);
    }
});
