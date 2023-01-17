import { findDarkModeOverrideKeys, convertToDarkMode } from './darkMode.mjs';
import test from 'ava';
import { darkModeTestTheme } from '../../../services/api/test/data/testThemes.js';
import Schemas from '../../schemas/index.js';

const schemas = new Schemas();

test.before(async t => {
    t.context.themeSchema = schemas.getSchemaJSON('themeData');
});

test('findDarkModeOverrideKeys identifies keys within schema items of type link', async t => {
    const colorKeys = await findDarkModeOverrideKeys(t.context.themeSchema);

    const blocksColorKeys = colorKeys
        .map(d => d.path)
        .filter(path => path.match(/^options\.blocks/));

    const expected = [
        'options.blocks.logo.data.options',
        'options.blocks.hr.data.border',
        'options.blocks.hr1.data.border',
        'options.blocks.hr2.data.border',
        'options.blocks.svg-rule.data.color',
        'options.blocks.svg-rule1.data.color',
        'options.blocks.svg-rule2.data.color'
    ];

    t.deepEqual(blocksColorKeys, expected);
});

test('findDarkModeOverrideKeys finds keys nested in arrays', async t => {
    // test theme is valid
    await schemas.validateThemeData(darkModeTestTheme);
    const colorKeys = await findDarkModeOverrideKeys(t.context.themeSchema, {
        data: darkModeTestTheme
    });
    const colorKeyPaths = colorKeys.map(d => d.path);

    [
        'options.blocks.logo.data.options.0.imgSrc',
        'options.blocks.logo.data.options.1.imgSrc',
        'vis.locator-maps.mapStyles.0.colors.land',
        'vis.locator-maps.mapStyles.0.layers.water.paint.fill-color',
        'colors.gradients.0.0',
        'colors.categories.0.0',
        'colors.palette.0'
    ].forEach(path => {
        t.is(colorKeyPaths.includes(path), true);
    });

    //  color arrays don't get mapped by array, but by individual items
    ['colors.gradients.0', 'colors.categories.0', 'colors.palette'].forEach(path => {
        t.is(colorKeyPaths.includes(path), false);
    });
});

test('findDarkModeOverride keys identifies keys for items with unit hexColorAndOpacity', async t => {
    const colorKeys = (await findDarkModeOverrideKeys(t.context.themeSchema)).map(d => d.path);
    ['style.chart.rangeAnnotations', 'style.chart.lineAnnotations'].forEach(path => {
        t.is(colorKeys.includes(path), true);
    });
});

test('theme converted to dark mode keeps blendBaseColorWithBg', async t => {
    const theme = {
        data: {
            style: { chart: { grid: { general: { baseLine: { blendBaseColorWithBg: 0.5 } } } } }
        }
    };
    await convertToDarkMode(t.context.themeSchema, {
        theme,
        darkBg: '#202020',
        origBg: '#ffffff'
    });
    t.is(theme.data.style.chart.grid.general.baseLine.blendBaseColorWithBg, 0.5);
});
