import test from 'ava';
import { getElementInnerText, getElementStyle } from '../helpers/setup.mjs';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test('two embeds with different themes', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'First chart',
            metadata: {
                visualize: {}
            }
        },
        themeData: { typography: { headline: { color: '#ff0000' } } }
    });

    await renderDummy(t, {
        webComponent: true,
        append: true,
        chart: {
            id: '00001',
            title: 'Second chart',
            metadata: {
                visualize: {}
            }
        },
        themeData: { typography: { headline: { color: '#0000ff' } } }
    });

    t.is(await getElementInnerText(page, 'shadow/#datawrapper-vis-00000 h3'), 'First chart');
    t.is(
        await getElementStyle(page, 'shadow/#datawrapper-vis-00000 h3', 'color'),
        'rgb(255, 0, 0)'
    );
    t.is(await getElementInnerText(page, 'shadow/#datawrapper-vis-00001 h3'), 'Second chart');
    t.is(
        await getElementStyle(page, 'shadow/#datawrapper-vis-00001 h3', 'color'),
        'rgb(0, 0, 255)'
    );
});
