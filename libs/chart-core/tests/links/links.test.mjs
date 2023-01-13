import test from 'ava';
import { before, beforeEach, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { getElementStyle } from '../helpers/setup.mjs';

test.before(before);
test.beforeEach(beforeEach);
test.afterEach.always(afterEach);
test.after(after);

const metadata = {
    describe: {
        intro: 'A <a href="#">link in the intro</a>'
    },
    annotate: {
        notes: 'Here are <a href="#">some links</a> in notes'
    }
};

test('default links', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        chart: { metadata }
    });
    t.is(await getElementStyle(page, '.description-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.description-block a', 'border-bottom-width'), '0px');
    t.is(await getElementStyle(page, '.notes-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.notes-block a', 'border-bottom-width'), '0px');
});

test('custom link style', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        chart: { metadata },
        themeData: {
            style: {
                body: { links: { border: { bottom: '2px solid #3399cc' }, padding: '0 0 5px' } }
            }
        }
    });
    t.is(await getElementStyle(page, '.description-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.notes-block a', 'border-bottom-width'), '2px');
    t.is(await getElementStyle(page, '.notes-block a', 'padding-bottom'), '5px');
    t.is(await getElementStyle(page, '.notes-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.notes-block a', 'border-bottom-width'), '2px');
    t.is(await getElementStyle(page, '.notes-block a', 'padding-bottom'), '5px');
});

test('custom footer link style', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        chart: { metadata },
        themeData: {
            style: {
                footer: { links: { border: { bottom: '2px solid #3399cc' }, padding: '0 0 5px' } }
            }
        }
    });
    t.is(await getElementStyle(page, '.description-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.description-block a', 'border-bottom-width'), '0px');
    t.is(await getElementStyle(page, '.description-block a', 'padding-bottom'), '0px');
    t.is(await getElementStyle(page, '.notes-block a', 'color'), 'rgb(51, 153, 204)');
    t.is(await getElementStyle(page, '.notes-block a', 'border-bottom-width'), '2px');
    t.is(await getElementStyle(page, '.notes-block a', 'padding-bottom'), '5px');
});

test('link typography styles', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        chart: { metadata },
        themeData: {
            typography: {
                links: {
                    color: '#ff0000',
                    cursive: 1,
                    underlined: 1,
                    fontWeight: 700,
                    lineHeight: 18,
                    typeface: 'My Link Font'
                }
            }
        }
    });

    t.is(await getElementStyle(page, '.description-block a', 'color'), 'rgb(255, 0, 0)');
    t.is(await getElementStyle(page, '.description-block a', 'text-decoration-line'), 'underline');
    t.is(await getElementStyle(page, '.description-block a', 'font-weight'), '700');
    t.is(await getElementStyle(page, '.description-block a', 'font-style'), 'italic');
    t.is(await getElementStyle(page, '.description-block a', 'line-height'), '18px');
    t.is(await getElementStyle(page, '.description-block a', 'font-family'), '"My Link Font"');

    t.is(await getElementStyle(page, '.notes-block a', 'color'), 'rgb(255, 0, 0)');
    t.is(await getElementStyle(page, '.notes-block a', 'text-decoration-line'), 'underline');
    t.is(await getElementStyle(page, '.notes-block a', 'font-weight'), '700');
    t.is(await getElementStyle(page, '.notes-block a', 'font-style'), 'italic');
    t.is(await getElementStyle(page, '.notes-block a', 'line-height'), '18px');
    t.is(await getElementStyle(page, '.notes-block a', 'font-family'), '"My Link Font"');
});

test('custom link style ignored for .link-style-ignore', async t => {
    const { page } = t.context;

    const metadata = {
        visualize: {
            'custom-markup': `
<style> .vis-button { color: #000000; text-decoration: none; } </style>
<a href="#" class="vis-button link-style-ignore"></a>
<a href="#" class="regular-link"></a>
`
        }
    };

    await renderDummy(t, {
        chart: { metadata },
        themeData: {
            typography: {
                links: {
                    color: '#ff0000',
                    underlined: true,
                    fontWeight: 700
                }
            },
            style: {
                body: {
                    links: {
                        border: { bottom: '2px solid #ff0000' },
                        padding: '0 0 5px'
                    }
                }
            }
        }
    });
    const REGULAR_LINK = '.dw-chart-body a.regular-link';
    const VIS_BUTTON = '.dw-chart-body a.vis-button';

    t.is(await getElementStyle(page, REGULAR_LINK, 'color'), 'rgb(255, 0, 0)');
    t.is(await getElementStyle(page, REGULAR_LINK, 'text-decoration-line'), 'underline');
    t.is(await getElementStyle(page, REGULAR_LINK, 'font-weight'), '700');
    t.is(await getElementStyle(page, REGULAR_LINK, 'border-bottom-width'), '2px');
    t.is(await getElementStyle(page, REGULAR_LINK, 'border-bottom-color'), 'rgb(255, 0, 0)');
    t.is(await getElementStyle(page, REGULAR_LINK, 'padding-bottom'), '5px');

    t.is(await getElementStyle(page, VIS_BUTTON, 'color'), 'rgb(0, 0, 0)');
    t.is(await getElementStyle(page, VIS_BUTTON, 'text-decoration-line'), 'none');
    t.is(await getElementStyle(page, VIS_BUTTON, 'font-weight'), '400');
    t.is(await getElementStyle(page, VIS_BUTTON, 'border-bottom-width'), '0px');
    t.is(await getElementStyle(page, VIS_BUTTON, 'padding-bottom'), '0px');
});

test('link styles not applied in static mode', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        chart: {
            metadata: {
                ...metadata,
                visualize: {
                    'custom-markup': `
        <style> .vis-dummy .vis-button { color: #ff0000; } </style>
        <a href="#" class="vis-button"></a>
        `
                }
            }
        },
        flags: { static: true },
        themeData: {
            typography: {
                chart: {
                    color: '#333333',
                    typeface: 'Helvetica'
                },
                description: {
                    color: '#555555',
                    fontWeight: 400
                },
                links: {
                    color: '#ff0000',
                    cursive: 1,
                    underlined: 1,
                    fontWeight: 700,
                    lineHeight: 18,
                    typeface: 'My Link Font'
                }
            },
            style: {
                body: {
                    links: {
                        padding: '0 0 5px',
                        border: {
                            bottom: '1px solid #000000'
                        }
                    }
                }
            }
        }
    });

    t.is(await getElementStyle(page, '.description-block a', 'color'), 'rgb(85, 85, 85)');
    t.is(await getElementStyle(page, '.description-block a', 'text-decoration-line'), 'none');
    t.is(await getElementStyle(page, '.description-block a', 'font-weight'), '400');
    t.is(await getElementStyle(page, '.description-block a', 'font-style'), 'normal');
    t.is(await getElementStyle(page, '.description-block a', 'font-family'), 'Helvetica');
    t.is(await getElementStyle(page, '.description-block a', 'border-bottom-style'), 'none');

    t.is(await getElementStyle(page, '.dw-chart-body .vis-button', 'color'), 'rgb(51, 51, 51)');
});
