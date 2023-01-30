import test from 'ava';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { getElementStyle } from '../helpers/setup.mjs';
import { setTimeout } from 'timers/promises';
import deepmerge from 'deepmerge';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

const chart = () => ({ title: 'Hello world', metadata: { annotate: { notes: 'Some notes.' } } });

const theme = () => ({
    style: {
        body: {
            background: '#ffffff'
        }
    },
    overrides: [
        {
            type: 'darkMode',
            settings: {
                'style.body.background': '#000000'
            }
        }
    ]
});

test('default is light', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: chart(),
        themeData: theme()
    });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(255, 255, 255)'
    );

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(255, 255, 255)'
    );
});

test('enforced dark mode', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: chart(),
        flags: { dark: true },
        themeData: theme()
    });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(0, 0, 0)'
    );

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(0, 0, 0)'
    );
});

test('auto dark mode (via flag)', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: chart(),
        flags: { dark: 'auto' },
        themeData: theme()
    });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(255, 255, 255)'
    );

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(0, 0, 0)'
    );
});

test('auto dark mode (via theme setting)', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: chart(),
        published: true,
        themeData: deepmerge(theme(), { options: { darkMode: { auto: true } } })
    });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(255, 255, 255)'
    );

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(0, 0, 0)'
    );
});

test('auto dark mode (via chart metadata setting)', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: deepmerge(chart(), { metadata: { publish: { autoDarkMode: true } } }),
        published: true,
        themeData: deepmerge(theme(), { options: { darkMode: { auto: 'user' } } })
    });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(255, 255, 255)'
    );

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);
    t.is(
        await getElementStyle(page, 'shadow/.dw-chart-styles', 'background-color'),
        'rgb(0, 0, 0)'
    );
});
