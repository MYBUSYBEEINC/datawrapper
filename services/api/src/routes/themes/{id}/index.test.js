const cloneDeep = require('lodash/cloneDeep');
const set = require('lodash/set');
const test = require('ava');
const { Theme, TeamTheme, Team } = require('@datawrapper/orm/db');
const {
    createUser,
    createTeamWithUser,
    createChart,
    createTheme,
    addThemeToTeam,
    destroy,
    setup,
    withTheme
} = require('../../../../test/helpers/setup');
const { darkModeTestTheme, darkModeTestBgTheme } = require('../../../../test/data/testThemes.js');

function getDarkTheme(t, themeId) {
    return t.context.server.inject({
        method: 'GET',
        url: `/v3/themes/${themeId}?dark=true`,
        auth: t.context.auth
    });
}

test.before(async t => {
    t.context.server = await setup({ usePlugins: false });
    t.context.userObj = await createUser(t.context.server);
    t.context.teamObj = await createTeamWithUser(t.context.server);
    t.context.auth = {
        strategy: 'session',
        credentials: t.context.userObj.session,
        artifacts: t.context.userObj.user
    };
    t.context.themes = await Promise.all([
        await Theme.findOrCreate({
            where: { id: 'my-theme-1' },
            defaults: {
                title: 'Test Theme',
                data: { test: 'test', deep: { key: [1, 2, 3] } },
                less: 'h1 { z-index: 1 }',
                assets: {}
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'my-theme-2' },
            defaults: {
                title: 'Test Theme 2',
                data: { test: 'test', deep: { key: [3, 4, 5] } },
                extend: 'my-theme-1',
                less: 'h1 { z-index: 2 }',
                assets: { key1: 1, key2: { deep: true } }
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'my-theme-3' },
            defaults: {
                title: 'Test Theme 3',
                data: { test: 'test3' },
                extend: 'my-theme-2',
                less: 'h1 { z-index: 3 }',
                assets: {
                    key1: 1,
                    key2: { blue: false },
                    Roboto: {
                        type: 'font',
                        import: 'https://static.dwcdn.net/css/roboto.css',
                        method: 'import'
                    }
                }
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'my-theme-4' },
            defaults: {
                title: 'Test Theme 4',
                data: { test: 'test4' },
                extend: 'my-theme-2',
                less: 'h1 { z-index: 3 }',
                assets: {
                    Roboto: {
                        type: 'font',
                        import: 'https://static.dwcdn.net/css/roboto.css',
                        method: 'import'
                    }
                }
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'my-theme-5' },
            defaults: {
                title: 'Test Theme 5',
                data: {},
                less: '',
                assets: {}
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'test-dark-mode-1' },
            defaults: {
                extend: 'my-theme-1',
                title: 'Test dark mode',
                data: darkModeTestTheme,
                less: '',
                assets: {}
            }
        }),
        await Theme.findOrCreate({
            where: { id: 'test-dark-mode-2' },
            defaults: {
                extend: 'my-theme-1',
                title: 'Test dark mode background',
                data: darkModeTestBgTheme,
                less: '',
                assets: {}
            }
        })
    ]);
    t.context.themeSchema = await t.context.server.methods.getSchemas().getSchemaJSON('themeData');
});

test.after.always(async t => {
    if (t.context.themes) {
        await destroy(
            ...t.context.themes,
            ...Object.values(t.context.teamObj),
            ...Object.values(t.context.userObj)
        );
    }
});

test('Should be possible to get theme data', async t => {
    const res = await t.context.server.inject({
        method: 'GET',
        url: '/v3/themes/my-theme-3',
        auth: t.context.auth
    });

    /* remove creation date or snapshots will fail all the time */
    delete res.result.createdAt;
    t.snapshot(res.result);
});

test('Should be possible to get theme font', async t => {
    const res = await t.context.server.inject({
        method: 'GET',
        url: '/v3/themes/my-theme-4',
        auth: t.context.auth
    });

    t.is(res.result.fontsCSS, '@import "https://static.dwcdn.net/css/roboto.css";');
});

test('Should be possible to get extended theme data', async t => {
    const res = await t.context.server.inject({
        method: 'GET',
        url: '/v3/themes/my-theme-3?extend=true',
        auth: t.context.auth
    });

    const theme = res.result;

    /* check that assets are shallow merged when extending */
    t.is(theme.assets.key2.deep, undefined);
    t.is(theme.assets.key2.blue, false);
    /* check if deep key from my-theme-2 was merged correctly */
    t.deepEqual(theme.data.deep.key, [3, 4, 5]);
    t.snapshot(theme.less);
    t.snapshot(theme.data);
});

function constructFormData(items) {
    const boundary = '----WebKitFormBoundaryz3uxR8Q4f0aAu3nl';
    const payload =
        items
            .map(
                ([key, val]) =>
                    `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}`
            )
            .join('\r\n') + `\r\n--${boundary}--\r\n`;

    return { contentType: `multipart/form-data; boundary=${boundary}`, payload };
}

test("Should be possible to upload a fonts by url that doesn't include all font formats", async t => {
    const { contentType, payload } = constructFormData([
        ['font-upload-method', 'url'],
        ['font-name', 'Roboto'],
        ['font-url-woff', 'https://static.dwcdn.net/css/fonts/roboto/roboto_400.woff'],
        ['font-url-ttf', 'https://static.dwcdn.net/css/fonts/roboto/roboto_400.ttf']
    ]);
    const res = await t.context.server.inject({
        method: 'POST',
        url: '/v3/themes/my-theme-3/font',
        auth: t.context.auth,
        headers: {
            'Content-Type': contentType
        },
        payload
    });

    t.is(res.statusCode, 200);
});

test("Shouldn't be possible to upload a font that doesn't include woff or woff2", async t => {
    const { contentType, payload } = constructFormData([
        ['font-upload-method', 'url'],
        ['font-name', 'Roboto'],
        ['font-url-ttf', 'https://static.dwcdn.net/css/fonts/roboto/roboto_400.ttf']
    ]);
    const res = await t.context.server.inject({
        method: 'POST',
        url: '/v3/themes/my-theme-3/font',
        auth: t.context.auth,
        headers: {
            'Content-Type': contentType
        },
        payload
    });

    t.is(res.statusCode, 400);
});

test('Should be possible to upload a font that includes woff2 only', async t => {
    const { contentType, payload } = constructFormData([
        ['font-upload-method', 'url'],
        ['font-name', 'Roboto'],
        ['font-url-woff2', 'https://static.dwcdn.net/css/fonts/roboto/roboto_400.woff2']
    ]);
    const res = await t.context.server.inject({
        method: 'POST',
        url: '/v3/themes/my-theme-3/font',
        auth: t.context.auth,
        headers: {
            'Content-Type': contentType
        },
        payload
    });

    t.is(res.statusCode, 200);
});

test('style.body.background overwritten with colors.background color where apprioriate', async t => {
    const res = await getDarkTheme(t, 'test-dark-mode-2');
    const data = res.result.data;

    // style.body.background does not get overwritten when transparent
    t.is(data.colors.background, '#191919');
    t.is(data.style.body.background, 'transparent');

    darkModeTestBgTheme.style.body.background = 'rgb(255, 255, 255)';

    const res2 = await t.context.server.inject({
        method: 'PATCH',
        url: '/v3/themes/test-dark-mode-2',
        payload: { data: darkModeTestBgTheme },
        auth: t.context.auth
    });

    t.is(res2.statusCode, 200);

    const res3 = await getDarkTheme(t, 'test-dark-mode-2');
    const data2 = res3.result.data;

    // but it does when it's the same color as colors.background
    t.is(data2.colors.background, '#191919');
    t.is(data2.style.body.background, '#191919');
});

test('Dark mode overrides work as expected', async t => {
    const res = await t.context.server.inject({
        method: 'GET',
        url: '/v3/themes/test-dark-mode-1?dark=true',
        auth: t.context.auth
    });

    t.is(res.statusCode, 200);

    const data = res.result.data;

    // specific override has been applied
    t.is(data.colors.palette[1], '#00ff00');

    // automatic conversion has been applied to remaining colors
    t.not(data.colors.palette[0], darkModeTestTheme.colors.palette[0]);
    t.not(data.colors.palette[2], darkModeTestTheme.colors.palette[2]);

    // color keys with 'noDarkModeInvert' don't get inverted
    t.is(data.vis['locator-maps'].mapStyles[0].colors.land, '#ffffff');

    // non-color items with overrideSupport: ['darkMode'] can be overwritten
    t.is(data.options.blocks.logo.data.options[0].imgSrc, 'https://domain/logo-white.png');

    // gradient has been overwritten
    t.deepEqual(data.colors.gradients[0], ['#ffffff', '#ffff00', '#ff0000']);

    // 'hexColorAndOpacity' has been overwritten
    const expectedRangeAnnotations = { color: '#727272', opacity: 0.16 };
    t.deepEqual(data.style.chart.rangeAnnotations, expectedRangeAnnotations);
});

test('Should be possible to update theme with valid less', async t => {
    const payload = {
        less: '.dw-chart { border: 5px solid red; }'
    };

    const res = await t.context.server.inject({
        method: 'PATCH',
        url: '/v3/themes/my-theme-5',
        auth: t.context.auth,
        headers: {
            'Content-Type': 'application/json'
        },
        payload
    });

    t.is(res.statusCode, 200);
});

test("Shouldn't be possible to update theme with invalid less", async t => {
    const payload = {
        less: '{.dw-chart { border: 5px solid red; }'
    };

    const res = await t.context.server.inject({
        method: 'PATCH',
        url: '/v3/themes/my-theme-5',
        auth: t.context.auth,
        headers: {
            'Content-Type': 'application/json'
        },
        payload
    });

    t.is(res.statusCode, 400);
});

test('Should be possible to update theme with valid color groups', async t => {
    const payload = {
        data: {
            colors: {
                groups: [{ colors: [['#ffffff', '#000000']] }]
            }
        }
    };

    const res = await t.context.server.inject({
        method: 'PATCH',
        url: '/v3/themes/my-theme-5',
        auth: t.context.auth,
        headers: {
            'Content-Type': 'application/json'
        },
        payload
    });
    t.is(res.statusCode, 200);
});

test("Shouldn't be possible to update theme with invalid color groups", async t => {
    const payload = {
        data: {
            colors: {
                groups: '#ffffff'
            }
        }
    };

    const res = await t.context.server.inject({
        method: 'PATCH',
        url: '/v3/themes/my-theme-5',
        auth: t.context.auth,
        headers: {
            'Content-Type': 'application/json'
        },
        payload
    });

    t.is(res.statusCode, 400);
});

test('Should be possible to delete a theme', async t => {
    const { teamObj } = t.context;
    let theme, chart;
    const themeId = 'theme-to-delete';
    try {
        theme = await createTheme({
            id: themeId,
            title: 'Theme to delete'
        });

        await addThemeToTeam(theme, teamObj.team);

        await Team.update({ default_theme: themeId }, { where: { id: teamObj.team.id } });

        let teamThemes = await TeamTheme.findAll({
            where: {
                theme_id: themeId,
                organization_id: teamObj.team.id
            }
        });

        t.is(teamThemes.length, 1);

        chart = await createChart({
            theme: themeId,
            author_id: teamObj.user.id,
            organization_id: teamObj.team.id
        });

        let res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${chart.id}`,
            headers: {
                authorization: `Bearer ${teamObj.token}`
            }
        });

        t.is(res.result.theme, themeId);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 200);

        res = await t.context.server.inject({
            method: 'DELETE',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 200);

        t.is(res.result.removedForTeams, 1);
        t.is(res.result.removedForUsers, 0);
        t.is(res.result.updatedCharts, 1);
        t.is(res.result.updatedTeamDefaultTheme, 1);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 404);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${chart.id}`,
            headers: {
                authorization: `Bearer ${teamObj.token}`
            }
        });

        t.is(res.result.theme, 'default');

        teamThemes = await TeamTheme.findAll({
            where: {
                theme_id: themeId,
                organization_id: teamObj.team.id
            }
        });

        t.is(teamThemes.length, 0);
    } finally {
        await destroy(theme, chart);
    }
});

test('Should be possible to delete a theme and migrate charts to a specific new theme', async t => {
    const { teamObj, themes } = t.context;
    let theme, chart;
    const themeId = 'theme-to-delete-2';
    try {
        theme = await createTheme({
            id: themeId,
            title: 'Theme to delete'
        });

        await addThemeToTeam(theme, teamObj.team);

        chart = await createChart({
            theme: themeId,
            author_id: teamObj.user.id,
            organization_id: teamObj.team.id
        });

        let res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${chart.id}`,
            headers: {
                authorization: `Bearer ${teamObj.token}`
            }
        });

        t.is(res.result.theme, themeId);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 200);

        res = await t.context.server.inject({
            method: 'DELETE',
            url: `/v3/themes/${themeId}?newChartTheme=${themes[0][0].id}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 200);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 404);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${chart.id}`,
            headers: {
                authorization: `Bearer ${teamObj.token}`
            }
        });

        t.is(res.result.theme, themes[0][0].id);
    } finally {
        await destroy(theme, chart);
    }
});

test("Not possible to delete theme when specified newChartTheme doesn't exist", async t => {
    const { teamObj } = t.context;
    let theme, chart;
    const themeId = 'theme-to-delete-3';
    try {
        theme = await createTheme({
            id: themeId,
            title: 'Theme to delete'
        });

        await addThemeToTeam(theme, teamObj.team);

        chart = await createChart({
            theme: themeId,
            author_id: teamObj.user.id,
            organization_id: teamObj.team.id
        });

        let res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/charts/${chart.id}`,
            headers: {
                authorization: `Bearer ${teamObj.token}`
            }
        });

        t.is(res.result.theme, themeId);

        res = await t.context.server.inject({
            method: 'GET',
            url: `/v3/themes/${themeId}`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 200);

        res = await t.context.server.inject({
            method: 'DELETE',
            url: `/v3/themes/${themeId}?newChartTheme=lalalalalala`,
            auth: t.context.auth
        });

        t.is(res.statusCode, 404);
    } finally {
        await destroy(theme, chart);
    }
});

test('GET /themes/{id} caches its return values', async t => {
    const server = await setup({
        usePlugins: false,
        testsConfigPatcher(config) {
            const result = cloneDeep(config);
            set(result, 'general.cache.themes', true);
            return result;
        },
        db: t.context.server.methods.getDB()
    });
    await withTheme(
        {
            title: 'Test theme cache'
        },
        async theme => {
            const res = await server.inject({
                method: 'GET',
                url: `/v3/themes/${theme.id}`,
                auth: t.context.auth
            });
            t.is(res.statusCode, 200);

            await Theme.update({ title: 'Test theme cache NEW' }, { where: { id: theme.id } });

            // Test that a second GET returns the cached title without "NEW".
            const resAfterEdit = await server.inject({
                method: 'GET',
                url: `/v3/themes/${theme.id}`,
                auth: t.context.auth
            });
            t.is(resAfterEdit.result.title, 'Test theme cache');
        }
    );
});

test('DELETE /themes/{id} drops cache', async t => {
    const server = await setup({
        usePlugins: false,
        testsConfigPatcher(config) {
            const result = cloneDeep(config);
            set(result, 'general.cache.themes', true);
            return result;
        },
        db: t.context.server.methods.getDB()
    });
    await withTheme(
        {
            title: 'Test theme cache'
        },
        async theme => {
            const res = await server.inject({
                method: 'GET',
                url: `/v3/themes/${theme.id}`,
                auth: t.context.auth
            });
            t.is(res.statusCode, 200);

            await server.inject({
                method: 'DELETE',
                url: `/v3/themes/${theme.id}`,
                auth: t.context.auth
            });

            // Test that a second GET returns error 404 and not a cached theme.
            const resAfterDelete = await server.inject({
                method: 'GET',
                url: `/v3/themes/${theme.id}`,
                auth: t.context.auth
            });
            t.is(resAfterDelete.statusCode, 404);
        }
    );
});
