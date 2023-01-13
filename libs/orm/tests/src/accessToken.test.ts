import anyTest, { type TestFn } from 'ava';
import type { ChartModel, DB, UserModel } from '@datawrapper/orm-lib';
import type { AccessToken } from '@datawrapper/orm-lib/db';
import { createChart, createUser, destroy } from './helpers/fixtures';
import { init } from './helpers/orm';

const test = anyTest as TestFn<{
    db: DB;
    chart: ChartModel;
    AccessToken: typeof AccessToken;
    user: UserModel;
}>;

test.before(async t => {
    t.context.db = await init();
    t.context.user = await createUser();
    t.context.chart = await createChart({ author_id: t.context.user.id });
    t.context.AccessToken = t.context.db.models.access_token;
});

test.after.always(async t => {
    await destroy(t.context.user, t.context.chart);
    await t.context.db.close();
});

test('AccessToken.newToken() creates an AccessToken with a random value', async t => {
    const { AccessToken, user } = t.context;
    let tokenId: number | undefined = undefined;
    try {
        const createResult = await AccessToken.newToken({
            type: 'orm-test-token',
            user_id: user.id,
            data: {
                ormTestKey1: 'ormTestValue1',
                ormTestKey2: 'ormTestValue2'
            }
        });

        tokenId = createResult.id;

        t.is(typeof createResult.token, 'string');
        t.is(typeof createResult.id, 'number');
    } finally {
        if (tokenId) {
            await AccessToken.destroy({ where: { id: tokenId } });
        }
    }
});

test('AccessToken.createChartAccessToken() creates a token with chart id and a random value', async t => {
    const { AccessToken, chart } = t.context;
    let tokenId: number | undefined = undefined;
    try {
        const createResult = await AccessToken.createChartExportToken(chart);

        tokenId = createResult.id;

        t.is(typeof createResult.token, 'string');
        t.is(typeof createResult.id, 'number');

        const findResult = await AccessToken.getExportedChartId(createResult.token);
        t.is(findResult, chart.id);
    } finally {
        if (tokenId) {
            await AccessToken.destroy({ where: { id: tokenId } });
        }
    }
});
