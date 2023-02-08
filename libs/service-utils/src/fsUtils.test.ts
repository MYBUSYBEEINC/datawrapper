import fs from 'fs';
import { fsUtils } from './fsUtils';
import test from 'ava';
import tmp from 'tmp';

const prefix = 'dw-service-utils-test-';

test('hasAccess returns true if the user has access to path', async t => {
    let tmpFile;
    try {
        tmpFile = tmp.fileSync({ prefix });
        t.true(await fsUtils.hasAccess(tmpFile.name, fs.constants.W_OK));
    } finally {
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('hasAccess returns false if the user does not have access to path', async t => {
    let tmpFile;
    try {
        tmpFile = tmp.fileSync({ prefix, mode: 0o400 });
        t.false(await fsUtils.hasAccess(tmpFile.name, fs.constants.W_OK));
    } finally {
        if (tmpFile) {
            tmpFile.removeCallback();
        }
    }
});

test('hasAccess returns false if the path does not exist', async t => {
    t.false(await fsUtils.hasAccess('spam.txt'));
});
