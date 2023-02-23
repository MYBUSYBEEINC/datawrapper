import anyTest, { type TestFn } from 'ava';
import type { DB, SessionModel, UserModel } from '@datawrapper/orm-lib';
import { createSession, createUser, destroy } from './helpers/fixtures';
import { init } from './helpers/orm';
import { QueryTypes } from 'sequelize';

const test = anyTest as TestFn<{
    db: DB;
    user: UserModel;
    session: SessionModel;
}>;

test.before(async t => {
    t.context.db = await init();
    t.context.user = await createUser();
    t.context.session = await createSession({
        data: {
            'dw-user-id': t.context.user.id,
            persistent: true,
            last_action_time: 123456789
        },
        user_id: t.context.user.id
    });
});

test.after.always(async t => {
    await destroy(t.context.user, t.context.session);
    await t.context.db.close();
});

test('Session.set() serializes session data into JSON', async t => {
    const { session, user } = t.context;
    const db = t.context.db;
    session.data = {
        last_action_time: 1671713700,
        'dw-user-id': user.id,
        persistent: true
    };
    await session.save();
    const result = await db.query<Record<string, unknown>>(
        'SELECT session_data FROM session WHERE session_id = :sessionId',
        {
            type: QueryTypes.SELECT,
            replacements: {
                sessionId: session.id
            }
        }
    );
    t.is(result.length, 1);
    t.is(
        result[0]?.['session_data'],
        `{"last_action_time":1671713700,"dw-user-id":${user.id},"persistent":true}`
    );
});

test('Session.get() unserializes session data stored in the old PHP format', async t => {
    const { session } = t.context;
    const db = t.context.db;
    await db.query('UPDATE session SET session_data = :sessionData WHERE session_id = :sessionId', {
        replacements: {
            sessionId: session.id,
            sessionData: `dw-user-id|N;persistent|b:0;last_action_time|i:1671713800;`
        }
    });
    await session.reload();
    t.is(session.data.last_action_time, 1671713800);
    t.is(session.data['dw-user-id'], null);
    t.is(session.data.persistent, false);
});

test('Session.get() unserializes session data stored in the new JSON format', async t => {
    const { session, user } = t.context;
    const db = t.context.db;
    await db.query('UPDATE session SET session_data = :sessionData WHERE session_id = :sessionId', {
        replacements: {
            sessionId: session.id,
            sessionData: `{"last_action_time":1671713900,"dw-user-id":${user.id},"persistent":true}`
        }
    });
    await session.reload();
    t.is(session.data.last_action_time, 1671713900);
    t.is(session.data['dw-user-id'], user.id);
    t.is(session.data.persistent, true);
});
