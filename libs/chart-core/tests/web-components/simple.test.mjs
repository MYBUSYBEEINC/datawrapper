import test from 'ava';
import { getElementInnerHtml, getElementInnerText } from '../helpers/setup.mjs';
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
