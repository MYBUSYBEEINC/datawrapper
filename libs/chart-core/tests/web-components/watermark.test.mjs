import test from 'ava';
import { getElementBoundingBox, getElementInnerHtml } from '../helpers/setup.mjs';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { setTimeout } from 'timers/promises';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

const loremIpsum =
    'Eu deserunt qui commodo laborum mollit officia. Laborum exercitation anim irure amet id cillum aliquip mollit nulla. Eu quis dolore pariatur quis non veniam laboris commodo enim excepteur cupidatat quis. Est esse deserunt ipsum. Ea commodo aliquip laboris enim proident do id occaecat minim ad nostrud do.';

test('show watermark defined in theme (web component)', async t => {
    const { page } = t.context;

    await page.$eval(
        'body',
        (body, loremIpsum) => {
            body.innerHTML = `<div style="max-width: 470px; margin: 0 auto"><p>${loremIpsum}</p><div id="wc-container"></div><p>${loremIpsum}</p></div>`;
        },
        loremIpsum
    );

    await setTimeout(500);

    await renderDummy(t, {
        webComponent: true,
        chart: { title: 'Watermark', metadata: { visualize: {} } },
        themeData: { options: { watermark: { text: 'CONFIDENTIAL' } } }
    });

    t.is(await getElementInnerHtml(page, 'shadow/.watermark'), 'CONFIDENTIAL');
    const bboxWatermark = await getElementBoundingBox(page, 'shadow/.watermark');
    const bboxBody = await getElementBoundingBox(page, 'shadow/.dw-chart-styles');
    const left = bboxWatermark.left - bboxBody.left;
    const right = bboxBody.right - bboxWatermark.right;

    // check that it's horizontically centered
    t.true(Math.abs(left - right) < 1);
});
