import test from 'ava';
import { getElementStyle, setViewportAndWait } from '../helpers/setup.mjs';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test('embed resizes when the container resizes', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {}
            }
        }
    });

    t.is(await getElementStyle(page, 'shadow/.vis-canvas', 'width'), `${600 - 16}px`); // 8px padding to both sides

    await setViewportAndWait(page, { width: 500, height: 600 });

    t.is(await getElementStyle(page, 'shadow/.vis-canvas', 'width'), `${500 - 16}px`);

    await setViewportAndWait(page, { width: 700, height: 600 });

    t.is(await getElementStyle(page, 'shadow/.vis-canvas', 'width'), `${700 - 16}px`);
});
