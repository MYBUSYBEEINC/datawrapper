import test from 'ava';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { getElementStyle } from '../helpers/setup.mjs';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test('plain flag is passed to web components', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        flags: { plain: true },
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {},
                describe: { byline: 'Someone' }
            }
        }
    });
    t.is(await page.$('shadow/.dw-chart-header'), null);
    t.not(await page.$('shadow/.dw-chart-body'), null);
    t.is(await page.$('shadow/.dw-chart-footer'), null);
    t.is(await page.$('shadow/.byline-block'), null);
});

test('static flag is passed to web components', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        flags: { static: true },
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {},
                describe: {
                    intro: 'There is a <a href="http://foo">link in the intro</a>, too',
                    byline: 'Someone',
                    'source-name': 'ABCD',
                    'source-url': 'http://www.example.com'
                }
            }
        },
        themeData: {
            typography: { footer: { color: '#999999' } }
        }
    });
    t.not(await page.$('shadow/.dw-chart-styles.static'), null);
    t.is(await page.$('shadow/.dw-chart-styles:not(.static)'), null);
    t.is(await getElementStyle(page, 'shadow/.source-block a', 'pointer-events'), 'none');
    t.is(await getElementStyle(page, 'shadow/.source-block a', 'color'), 'rgb(153, 153, 153)');
    t.is(await getElementStyle(page, 'shadow/.description-block a', 'color'), 'rgb(24, 24, 24)');
});
