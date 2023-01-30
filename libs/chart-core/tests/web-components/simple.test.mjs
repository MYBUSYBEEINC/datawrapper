import test from 'ava';
import {
    getElementInnerHtml,
    getElementInnerText,
    getElementBoundingBox,
    getElementStyle,
    getElementClasses
} from '../helpers/setup.mjs';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test('default headline + footer', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {},
                describe: { byline: 'Someone' }
            }
        }
    });

    t.is(await getElementInnerHtml(page, 'shadow/.dw-chart-header h3 span'), 'Hello world');
    t.is((await getElementInnerText(page, 'shadow/.byline-block')).trim(), 'Chart: Someone');
});

test.only('web component right to left', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        textDirection: 'rtl',
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {},
                describe: { byline: 'Someone' }
            }
        }
    });

    t.deepEqual(await getElementClasses(page, 'shadow/#datawrapper-vis-00000'), [
        'vis-height-fit',
        'vis-dummy',
        'dir-rtl'
    ]);
    t.is(await getElementStyle(page, 'shadow/.dw-chart-footer', 'direction'), 'rtl');
    const titleBbox = await getElementBoundingBox(page, 'shadow/.dw-chart-header h3 span');
    t.is(titleBbox.right, 600 - 8);
    const bylineBbox = await getElementBoundingBox(page, 'shadow/.dw-chart-header h3 span');
    t.is(bylineBbox.right, 600 - 8);
});
