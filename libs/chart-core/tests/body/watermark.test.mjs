import test from 'ava';
import {
    getElementAttribute,
    getElementBoundingBox,
    getElementInnerHtml,
    getElementStyle
} from '../helpers/setup.mjs';
import { before, beforeEach, after, afterEach, renderDummy } from '../helpers/utils.mjs';

test.before(before);
test.beforeEach(beforeEach);
test.afterEach.always(afterEach);
test.after(after);

const rotateReg = new RegExp(/^rotate\((-?\d+(?:\.\d+?)?)\)$/);

test('show watermark defined in theme', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            chart: { metadata: { annotate: { notes: 'Notes' } } },
            themeData: { options: { watermark: { text: 'CONFIDENTIAL' } } }
        },
        1000
    );

    t.is(await getElementInnerHtml(page, '.watermark'), 'CONFIDENTIAL');
    const bboxWatermark = await getElementBoundingBox(page, '.watermark');
    const bboxBody = await getElementBoundingBox(page, '.dw-chart-styles');
    const left = bboxWatermark.left - bboxBody.left;
    const right = bboxBody.right - bboxWatermark.right;
    // check that it's horizontically centered
    t.true(Math.abs(left - right) < 1);
    // check rotation
    const transform = await getElementAttribute(page, '.watermark', 'transform');
    t.true(rotateReg.test(transform), 'transform string is rotation ' + transform);
    const angle = +transform.match(rotateReg)[1];
    t.not(angle, 0);
    t.true(angle < 0);
});

test('themes can disable rotation', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            chart: { metadata: { annotate: { notes: 'Notes' } } },
            themeData: { options: { watermark: { text: 'CONFIDENTIAL', rotate: false } } }
        },
        1000
    );

    t.is(await getElementInnerHtml(page, '.watermark'), 'CONFIDENTIAL');
    const bboxWatermark = await getElementBoundingBox(page, '.watermark');
    const bboxBody = await getElementBoundingBox(page, '.dw-chart-styles');
    const left = bboxWatermark.left - bboxBody.left;
    const right = bboxBody.right - bboxWatermark.right;
    // check that it's horizontically centered
    t.true(Math.abs(left - right) < 1);
    // check rotation
    const transform = await getElementAttribute(page, '.watermark', 'transform');
    t.true(rotateReg.test(transform), 'transform string is rotation ' + transform);
    const angle = +transform.match(rotateReg)[1];
    t.is(angle, 0);
});

test('invert watermark rotation angle in RTL', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            textDirection: 'rtl',
            chart: { metadata: { annotate: { notes: 'Notes' } } },
            themeData: { options: { watermark: { text: 'CONFIDENTIAL' } } }
        },
        1000
    );

    // check rotation
    const transform = await getElementAttribute(page, '.watermark', 'transform');
    t.true(rotateReg.test(transform), 'transform string is rotation ' + transform);
    const angle = +transform.match(rotateReg)[1];
    t.not(angle, 0);
    t.true(angle > 0);
});

test('themes can set a fixed font size', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            chart: { metadata: { annotate: { notes: 'Notes' } } },
            themeData: {
                options: { watermark: { text: 'CONFIDENTIAL', typography: { fontSize: 24 } } }
            }
        },
        1000
    );

    t.is(await getElementInnerHtml(page, '.watermark'), 'CONFIDENTIAL');
    t.is(await getElementStyle(page, '.watermark', 'fontSize'), '24px');
});

test('themes style watermarks', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            chart: { metadata: { annotate: { notes: 'Notes' } } },
            themeData: {
                options: {
                    watermark: {
                        text: 'CONFIDENTIAL',
                        opacity: 0.5,
                        typography: { color: '#ff0000', fontWeight: 'normal' }
                    }
                }
            }
        },
        1000
    );

    t.is(await getElementInnerHtml(page, '.watermark'), 'CONFIDENTIAL');
    t.is(await getElementStyle(page, '.watermark', 'opacity'), '0.5');
    t.is(await getElementStyle(page, '.watermark', 'fontWeight'), '400');
    t.is(await getElementStyle(page, '.watermark', 'color'), 'rgb(255, 0, 0)');
});

test('show watermark defined via custom field', async t => {
    const { page } = t.context;

    await renderDummy(
        t,
        {
            chart: { metadata: { visualize: {}, custom: { note: 'DRAFT' } } },
            themeData: { options: { watermark: { 'custom-field': 'note' } } }
        },
        1000
    );

    t.is(await getElementInnerHtml(page, '.watermark'), 'DRAFT');
    const bboxWatermark = await getElementBoundingBox(page, '.watermark');
    const bboxBody = await getElementBoundingBox(page, '.dw-chart-styles');
    const left = bboxWatermark.left - bboxBody.left;
    const right = bboxBody.right - bboxWatermark.right;
    // check that it's horizontically centered
    t.true(Math.abs(left - right) < 1);
});

test('hide watermark defined via custom field if field is empty', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        chart: { metadata: { visualize: {}, custom: { note: '' } } },
        themeData: { options: { watermark: { 'custom-field': 'note' } } }
    });
    const mark = await page.$('.watermark');
    t.is(mark, null);
});
