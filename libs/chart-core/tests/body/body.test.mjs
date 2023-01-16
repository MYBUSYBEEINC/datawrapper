import test from 'ava';
import { before, beforeEach, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { getElementStyle } from '../helpers/setup.mjs';
import { setTimeout } from 'timers/promises';

test.before(before);
test.beforeEach(beforeEach);
test.afterEach.always(afterEach);
test.after(after);

test('core body styles', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        themeData: {
            style: {
                body: {
                    border: {
                        bottom: '1px solid #ff0000',
                        left: '1px solid #ff0000',
                        right: '1px solid #ff0000',
                        top: '1px solid #ff0000'
                    },
                    margin: '5px 0',
                    padding: '10px'
                }
            }
        }
    });
    t.is(
        await getElementStyle(page, '.dw-chart-styles', 'border-bottom'),
        '1px solid rgb(255, 0, 0)'
    );
    t.is(
        await getElementStyle(page, '.dw-chart-styles', 'border-left'),
        '1px solid rgb(255, 0, 0)'
    );
    t.is(
        await getElementStyle(page, '.dw-chart-styles', 'border-right'),
        '1px solid rgb(255, 0, 0)'
    );
    t.is(await getElementStyle(page, '.dw-chart-styles', 'border-top'), '1px solid rgb(255, 0, 0)');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'margin'), '5px 0px');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'padding'), '10px');
});

test('chart typography', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        themeData: {
            typography: {
                chart: {
                    color: '#ff0000',
                    fontSize: 13,
                    fontStretch: 'condensed',
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    typeface: 'Arial'
                }
            }
        }
    });
    t.is(await getElementStyle(page, '.dw-chart-styles', 'color'), 'rgb(255, 0, 0)');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'font-size'), '13px');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'font-stretch'), '75%');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'letter-spacing'), '1.5px');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'text-transform'), 'uppercase');
    t.is(await getElementStyle(page, '.dw-chart-styles', 'font-family'), 'Arial');
});

test(':global styles', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        flags: { inEditor: true, dark: 'auto' },
        textDirection: 'rtl',
        chart: {
            metadata: {
                visualize: {
                    'custom-markup': [
                        '<div class="filter-ui"><div class="point active"></div></div>',
                        '<div class="filter-ui filter-links"><a class="active"></a></div>',
                        '<div class="sr-only"></div>'
                    ].join('\n')
                },
                describe: {
                    intro: '<span class="hide-in-dark">Light mode text</span><span class="hide-in-light">Dark mode text</span>',
                    'source-name': 'Wikipedia',
                    byline: 'Datawrapper'
                },
                annotate: {
                    notes: 'Notes text <span class="hidden"></span> <span class="hide"></span>'
                },
                publish: {
                    blocks: { logo: { enabled: true } }
                }
            }
        },
        themeData: {
            typography: {
                description: { color: '#ff0000' }
            },
            style: {
                body: { background: '#ffffff' }
            },
            overrides: [
                {
                    type: 'darkMode',
                    settings: { 'style.body.background': '#000000' }
                }
            ],
            options: {
                blocks: {
                    byline: { region: 'belowHeader' },
                    source: { region: 'belowFooter' },
                    logo: {
                        region: 'headerRight',
                        data: { options: [{ text: 'LOGO', id: 'logo', title: 'logo' }] }
                    }
                }
            }
        }
    });

    t.is(await getElementStyle(page, 'body', 'padding-bottom'), '10px');
    t.is(await getElementStyle(page, '.chart.vis-height-fit', 'overflow'), 'hidden');

    t.is(await getElementStyle(page, '.chart .filter-ui .point.active', 'height'), '20px');
    t.is(
        await getElementStyle(page, '.chart .filter-ui.filter-links a.active', 'box-shadow'),
        'none'
    );

    t.is(await getElementStyle(page, '.description-block .hide-in-light', 'display'), 'none');
    t.is(await getElementStyle(page, '.description-block .hide-in-dark', 'display'), 'inline');

    t.is(await getElementStyle(page, '.notes-block .hidden', 'display'), 'none');
    t.is(await getElementStyle(page, '.notes-block .hide', 'display'), 'none');

    t.is(await getElementStyle(page, '.dw-chart-footer', 'direction'), 'rtl');
    t.is(await getElementStyle(page, '.dw-chart-header', 'direction'), 'rtl');
    t.is(await getElementStyle(page, '.dw-below-header', 'direction'), 'rtl');
    t.is(await getElementStyle(page, '.dw-above-footer', 'direction'), 'rtl');
    t.is(await getElementStyle(page, '.dw-below-footer', 'direction'), 'rtl');

    t.is(await getElementStyle(page, '.dw-chart-header.has-header-right', 'display'), 'flex');

    t.is(await getElementStyle(page, '.dw-chart-body .sr-only', 'position'), 'absolute');
    t.is(await getElementStyle(page, '.dw-chart-body .sr-only', 'left'), '-9999px');
    t.is(await getElementStyle(page, '.dw-chart-body .sr-only', 'height'), '1px');

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await setTimeout(300);

    t.is(await getElementStyle(page, '.description-block .hide-in-light', 'display'), 'inline');
    t.is(await getElementStyle(page, '.description-block .hide-in-dark', 'display'), 'none');
});
