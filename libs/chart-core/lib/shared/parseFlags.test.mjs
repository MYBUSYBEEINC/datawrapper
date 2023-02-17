import test from 'ava';
import { parseFlagsFromURL } from './parseFlags.mjs';
import '../../tests/helpers/setup-browser-env.mjs';

const searchString =
    'a=text&' +
    'b=text%20with%20spaces&' +
    'c={"obj":"obj"}&' +
    'd=0&' +
    'e=0.0&' +
    'f=1&' +
    'g=1.2&' +
    'h=true&' +
    'i=false&' +
    'j=null&' +
    'k=NaN&' +
    'l=';

test('parseFlagsFromURL parses flags as string', t => {
    t.deepEqual(
        parseFlagsFromURL(searchString, {
            a: String,
            b: String,
            c: String,
            d: String,
            e: String,
            f: String,
            g: String,
            h: String,
            i: String,
            j: String,
            k: String,
            l: String,
            missing: String
        }),
        {
            a: 'text',
            b: 'text with spaces',
            c: '{"obj":"obj"}',
            d: '0',
            e: '0.0',
            f: '1',
            g: '1.2',
            h: 'true',
            i: 'false',
            j: 'null',
            k: 'NaN',
            l: '',
            missing: null
        }
    );
});

test('parseFlagsFromURL parses flags as boolean', t => {
    t.deepEqual(
        parseFlagsFromURL(searchString, {
            a: Boolean,
            b: Boolean,
            c: Boolean,
            d: Boolean,
            e: Boolean,
            f: Boolean,
            g: Boolean,
            h: Boolean,
            i: Boolean,
            j: Boolean,
            k: Boolean,
            l: Boolean,
            missing: Boolean
        }),
        {
            a: true,
            b: true,
            c: true,
            d: false, // 0
            e: true,
            f: true,
            g: true,
            h: true,
            i: false, // false
            j: false, // null
            k: true,
            l: false, // empty string
            missing: false
        }
    );
});

test('parseFlagsFromURL ignores flags that do not appear in the types object', t => {
    t.deepEqual(
        parseFlagsFromURL('a=a&b=b&c=c', {
            b: String
        }),
        {
            b: 'b'
        }
    );
});

test('parseFlagsFromURL uses the first value in case of duplicate parameters', t => {
    t.deepEqual(
        parseFlagsFromURL('a=1&a=2', {
            a: String
        }),
        {
            a: '1'
        }
    );
});

test('parse dark flag from URL', t => {
    t.is(parseFlagsFromURL('dark=true').dark, true);
    t.is(parseFlagsFromURL('dark=1').dark, true);
    t.is(parseFlagsFromURL('dark=0').dark, false);
    t.is(parseFlagsFromURL('dark=false').dark, false);
    t.is(parseFlagsFromURL('dark=auto').dark, 'auto');
    t.is(parseFlagsFromURL('a=2').dark, null); // check we don't set to false automatically
});
