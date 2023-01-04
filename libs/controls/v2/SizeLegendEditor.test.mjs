/* eslint no-new: 0 */

import test from 'ava';
import $ from 'cash-dom';
import Chart from '@datawrapper/chart-core/lib/dw/svelteChart.mjs';
import SizeLegendEditor from './SizeLegendEditor.html';

test.beforeEach(t => {
    t.context.target = $('<div />');
    $(document.body).empty().append(t.context.target);

    t.context.chart = new Chart({
        textDirection: 'ltr'
    });

    // t.context.chart.set({});
});

const initialData = () => ({
    value: {
        enabled: true,
        legendType: '',
        labelPosition: '',
        legendValues: 'custom', // 'custom'
        legendValuesCustom: [1, 10, 100],
        labelFormat: '',
        position: '',
        legendOffsetX: 0,
        legendOffsetY: 0,
        showTitle: true,
        titlePosition: 'top',
        titleWidth: 100
    },
    uid: '',
    allowPositionInside: true,
    rtl: false,
    labelWidth: '100px',
    disabled: false,
    defaultTitle: null,
    initialTitle: null,
    maxSize: null,
    shape: 'symbolCircle'
});

test('Render simple SizeLegendEditor', t => {
    const comp = new SizeLegendEditor({
        target: t.context.target[0],
        store: t.context.chart,
        data: initialData()
    });

    t.truthy(t.context.target.find('div[data-uid=legend-values-custom] input'));
    const input = t.context.target.find('div[data-uid=legend-values-custom] input');
    t.is(input[0].value, '1,10,100');
    const { value } = comp.get();
    t.deepEqual(value.legendValuesCustom, [1, 10, 100]);
});

test('Clearing and re-entering custom value input', async t => {
    const comp = new SizeLegendEditor({
        target: t.context.target[0],
        store: t.context.chart,
        data: initialData()
    });

    t.deepEqual(comp.get().legendValuesCustom, '1,10,100');
    t.deepEqual(comp.get().value.legendValuesCustom, [1, 10, 100]);

    const input = t.context.target.find('div[data-uid=legend-values-custom] input');
    t.is(input[0].value, '1,10,100');

    input.val('').trigger('input');
    t.is(input[0].value, '');
    t.deepEqual(comp.get().value.legendValuesCustom, null);

    input.val('9,8,7').trigger('input');
    t.is(input[0].value, '9,8,7');
    t.deepEqual(comp.get().value.legendValuesCustom, [9, 8, 7]);
});

test('Switching from custom values to auto', async t => {
    const comp = new SizeLegendEditor({
        target: t.context.target[0],
        store: t.context.chart,
        data: initialData()
    });

    const inputs = t.context.target.find('div[data-uid=legend-values-toggle] input');
    inputs.eq(0).trigger('click');
    t.deepEqual(comp.get().value.legendValuesCustom, null);

    inputs.eq(1).trigger('click');
    t.deepEqual(comp.get().value.legendValuesCustom, [1, 10, 100]);
});
