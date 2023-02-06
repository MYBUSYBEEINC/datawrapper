import test from 'ava';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test("don't inject custom afterChart HTML in web component embeds", async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: { visualize: {} }
        },
        themeData: { template: { afterChart: '<div class="custom-html">injection</div>' } }
    });

    t.is(await page.$('shadow/.custom-html'), null);
});
