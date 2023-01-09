/* eslint no-new: 0 */

import test from 'ava';
import $ from 'cash-dom';
import Chart from '@datawrapper/chart-core/lib/dw/svelteChart.mjs';
import Column from '@datawrapper/chart-core/lib/dw/dataset/column';
import ColorLegendEditor from './ColorLegendEditor.html';
import ColorScaleEditor from './ColorScaleEditor.html';

test.beforeEach(t => {
    t.context.target = $('<div />');
    $(document.body).empty().append(t.context.target);

    t.context.chart = new Chart({
        metadata: {}
    });
});

const columns = [Column('normal', [1, 20, 40, 50, 100], 'number')];

const colorScaleData = () => ({
    value: {
        mode: 'discrete',
        interpolation: 'equidistant',
        stops: 'pretty',
        stopCount: 2,
        rangeMin: '0',
        rangeMax: '100',
        rangeCenter: '',
        colors: ['#b2182b', '#ef8a62', '#fddbc7', '#f8f6e9', '#d1e5f0', '#67a9cf', '#2166ac'].map(
            (color, i) => ({ color, position: i / 6 })
        )
    },
    columns,
    column: columns[0]
});

test("Correct number of custom labels created for color scale with 'pretty' stops", t => {
    const colorScaleEditorComp = new ColorScaleEditor({
        target: t.context.target[0],
        store: t.context.chart,
        data: colorScaleData()
    });

    let { colorScaleFunction, value: colorscale } = colorScaleEditorComp.get();

    const comp = new ColorLegendEditor({
        target: t.context.target[0],
        store: t.context.chart,
        data: {
            value: {
                hideItems: [],
                labels: 'custom',
                customLabels: ['Custom 1', 'Custom 2']
            },
            colorscale,
            colorScaleFunction
        }
    });

    t.deepEqual(comp.get().value.customLabels, ['Custom 1', 'Custom 2']);

    updateScaleStopCount(3);
    t.deepEqual(comp.get().value.customLabels, ['Custom 1', 'Custom 2']);

    updateScaleStopCount(4);
    t.deepEqual(comp.get().value.customLabels, [
        'Custom 1',
        'Custom 2',
        'Group C',
        'Group D',
        'Group E'
    ]);

    updateScaleStopCount(5);
    t.deepEqual(comp.get().value.customLabels, [
        'Custom 1',
        'Custom 2',
        'Group C',
        'Group D',
        'Group E'
    ]);

    updateScaleStopCount(8);
    t.deepEqual(comp.get().value.customLabels, [
        'Custom 1',
        'Custom 2',
        'Group C',
        'Group D',
        'Group E',
        'Group F',
        'Group G',
        'Group H',
        'Group I',
        'Group J'
    ]);

    function updateScaleStopCount(stopCount) {
        colorScaleEditorComp.set({ value: { ...colorscale, stopCount } });
        ({ colorScaleFunction, value: colorscale } = colorScaleEditorComp.get());
        comp.set({ colorScaleFunction, colorscale });
    }
});
