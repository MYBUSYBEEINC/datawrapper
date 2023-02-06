import test from 'ava';
import { getElementInnerText } from '../helpers/setup.mjs';
import { before, beforeEach, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(before);
test.beforeEach(beforeEach);
test.afterEach.always(afterEach);
test.after(after);

test('inject custom HTML in iframe embeds', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        chart: {
            title: 'Hello world',
            metadata: { visualize: {} }
        },
        themeData: { template: { afterChart: '<div class="custom-html">injection</div>' } }
    });

    t.is(await getElementInnerText(page, '.custom-html'), 'injection');
});
