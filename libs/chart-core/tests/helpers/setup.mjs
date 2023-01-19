import { readFile, mkdir } from 'fs/promises';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import get from '@datawrapper/shared/get.js';
import set from '@datawrapper/shared/set.js';
import cloneDeep from 'lodash/cloneDeep.js';
import slugify from '@datawrapper/shared/slugify.js';
import chartCore from '../../index.js';
import { createHash } from 'crypto';
import deepmerge from 'deepmerge';
import { compileCSS } from '../../lib/styles/compile-css.js';
import { MemoryCache, defaultChartMetadata } from '@datawrapper/service-utils';
import Schemas from '../../../schemas/index.js';
import { JSDOM } from 'jsdom';
import createEmotion from '@emotion/css/create-instance';
import createEmotionServer from '@emotion/server/create-instance';
import { setTimeout } from 'timers/promises';
import { convertToDarkMode, getBackgroundColors } from '../../lib/darkMode.mjs';

const schemas = new Schemas();

const pathToChartCore = join(dirname(fileURLToPath(import.meta.url)), '../..');

const emptyPage = `<html>
        <body>
            <div class="dw-chart" id="__svelte-dw"></div>
        </body>
    </html>`;

/**
 * Creates a new Puppeteer browser
 * @param {Object} puppeteerOptions
 * @param {boolean} puppeteerOptions.headless set to false to visually debug page
 * @param {boolean} puppeteerOptions.devtools set to true to open page with devtools on
 * @param {string[]} puppeteerOptions.args
 * @returns {Browser}
 */
export function createBrowser(puppeteerOptions = {}) {
    return puppeteer.launch(puppeteerOptions);
}

/**
 * Creates a new empty HTML page with a DOM ready to
 * render visualizations in it.
 *
 * @param {Browser} browser
 * @param {Object} viewportOpts
 * @param {number} viewportOpts.width
 * @param {number} viewportOpts.height
 * @param {number} viewportOpts.deviceScaleFactor
 * @returns {Promise} Promise that resolves when the page has been created
 */
export async function createPage(browser, viewportOpts = {}) {
    const page = await browser.newPage();
    await page.setViewport({
        width: 600,
        height: 500,
        deviceScaleFactor: 1,
        ...viewportOpts
    });

    await page.setContent(emptyPage);

    await page.addScriptTag({
        content: await readFile(join(pathToChartCore, 'dist/dw-2.0.min.js'), 'utf-8')
    });

    return page;
}

/**
 * Renders a chart described by `props` on a Puppeteer `page`.
 *
 * @param {Page} page Puppeteer page instance
 * @param {Object} props
 * @param {Object} props.chart
 * @param {string} props.dataset
 * @param {Object} props.theme
 * @param {Object} props.translations
 * @param {Object} props.visMeta
 * @param {Object} props.flags
 * @param {Object} props.assets
 * @param {Object} props.textDirection
 * @param {number} delay further delay render promise (useful for debugging)
 * @returns {Object[]} console log messages
 */
export async function render(page, props, delay) {
    if (!props.visMeta) throw new Error('need to provide visMeta');
    if (props.theme) {
        console.warn('Warning: `theme` is deprecated, please use `themeData` instead');
        props.themeData = props.theme;
    }
    // extend theme from baseTheme
    const baseTheme = JSON.parse(
        await readFile(join(pathToChartCore, 'tests/helpers/data/theme.json'), 'utf-8')
    );
    props.theme = baseTheme;
    if (props.themeData) {
        props.theme.data = deepmerge.all([{}, baseTheme.data, props.themeData], {
            // don't try to merge arrays, just overwrite them
            arrayMerge: (target, source) => source
        });
    }
    // validate theme data
    await schemas.validateThemeData(props.theme.data);
    // extend chart metadata from default chart metadata
    props.chart.id = '00000';
    props.chart.metadata = deepmerge.all([{}, defaultChartMetadata, props.chart.metadata || {}]);
    props.chart.theme = props.theme.id;
    // default translations
    props.translations = props.translations || { 'en-US': {} };

    // compile and load LESS styles
    const css = await getCSS(props);
    if (css) {
        await page.addStyleTag({
            content: css
        });
    }

    // preload chart assets
    const assets = {
        [`dataset.${get(props.chart, 'metadata.data.json', false) ? 'json' : 'csv'}`]: {
            load: true,
            value: props.dataset
        },
        ...Object.fromEntries(
            Object.entries(props.assets || {}).map(([filename, content]) => [
                filename,
                { load: true, value: content }
            ])
        )
    };

    // load plugin chart-core blocks
    const blocks = [];
    const loadPlugins = [];
    if (props.blocksPlugins) {
        for (const plugin of props.blocksPlugins) {
            blocks.push(plugin.blocks);
            loadPlugins.push(page.addScriptTag({ content: await readFile(plugin.js, 'utf-8') }));
            loadPlugins.push(page.addStyleTag({ content: await readFile(plugin.css, 'utf-8') }));
        }
    }
    await Promise.all(loadPlugins);

    const flags = props.flags || {};

    const state = {
        ...props,
        blocks,
        assets,
        visualization: props.visMeta,
        renderFlags: flags,
        // hack for dark mode
        themeDataLight: props.theme.data,
        themeDataDark: await getThemeDataDark(props.theme.data),
        // translate flags into props
        isEditingAllowed: !!flags.inEditor,
        isStylePlain: !!flags.plain,
        isStyleStatic: !!flags.static,
        isStyleTransparent: !!flags.transparent,
        isAutoDark: flags.dark === 'auto'
    };

    if (!props.skipSSR) {
        // ssr pre-rendering
        // server-side emotion
        const dom = new JSDOM(`<!DOCTYPE html><head /><body />`);
        const emotion = (props.emotion = createEmotion.default({
            key: `datawrapper`,
            container: dom.window.document.head
        }));
        const { html } = chartCore.svelte.render({ ...state, emotion });
        const { extractCritical } = createEmotionServer.default(emotion.cache);
        const { css: emotionCSS } = extractCritical(html);

        await page.evaluate(
            async ({ html }) => {
                document.querySelector('#__svelte-dw').innerHTML = html;
            },
            { html }
        );

        await page.addStyleTag({ content: emotionCSS });
    }

    // inject state to page
    await page.addScriptTag({
        content: `window.__DW_SVELTE_PROPS__ = ${JSON.stringify(state)};`
    });

    // collect console.logs
    const logs = [];
    page.on('console', event => {
        const text = event.text();
        if (text.startsWith('Chart rendered in')) return;
        logs.push({ type: event.type(), text: event.text() });
        if (process.env.DEBUG) process.stdout.write(`LOG: ${event.text()}\n`);
        // log errors instantly
        if (event.type() === 'error') console.error('ERROR: ' + event.text());
    });
    page.on('pageerror', ({ message }) => {
        // log errors instantly
        console.error('ERROR: ' + message);
        logs.push({ type: 'error', text: message });
    });

    // set container classes
    await page.evaluate(async ({ chart, textDirection }) => {
        /* eslint-env browser */
        const container = document.querySelector('.dw-chart');
        container.setAttribute(
            'class',
            `dw-chart chart theme-${chart.theme} vis-${chart.type} ${
                textDirection === 'rtl' ? 'dir-rtl' : ''
            }`
        );
    }, props);

    // render the chart using chart-core/Visualization.svelte
    await page.addScriptTag({
        content: await readFile(join(pathToChartCore, 'dist/main.js'), 'utf-8')
    });
    if (delay) await setTimeout(delay);
    return logs;
}

/**
 * this cache is used to avoid compiling LESS for the same
 * theme-vis combination multiple times during the same test
 * run
 */
const styleCache = new MemoryCache();

/**
 * Compiles the CSS stylesheet for a given theme-vis combination
 *
 * @param {Object} props
 * @param {Object} props.visMeta
 * @param {Object} props.theme
 * @returns {string} the css code
 */
async function getCSS(props) {
    const key = createHash('md5')
        .update(
            JSON.stringify({
                vis: props.visMeta.less,
                theme: props.theme.data
            })
        )
        .digest('hex');
    return styleCache.withCache(key, () => {
        return compileCSS({
            theme: { id: 'test', data: props.theme.data },
            filePaths: [props.visMeta.less].filter(d => d)
        });
    });
}

/**
 * Returns array with all CSS classes set for the specified selector
 *
 * @param {Page} page
 * @param {string} selector
 * @returns {string[]}
 */
export function getElementClasses(page, selector) {
    return page.$eval(selector, node => Array.from(node.classList));
}

/**
 * Returns a computed style for a given CSS selector
 * @param {Page} page
 * @param {string} selector
 * @param {string} style css property, e.g. "marginTop"
 * @returns {string}
 */
export function getElementStyle(page, selector, style, pseudo = undefined) {
    return page.$eval(
        selector,
        (node, style, pseudo) => getComputedStyle(node, pseudo)[style],
        style,
        pseudo
    );
}

/**
 * Returns the bounding box for a given selector
 * @param {Page} page
 * @param {string} selector
 * @returns {object}
 */
export function getElementBoundingBox(page, selector) {
    return page.$eval(selector, node => {
        const bbox = node.getBoundingClientRect();
        return { left: bbox.left, right: bbox.right, top: bbox.top, bottom: bbox.bottom };
    });
}

/**
 * Returns the value of `attr` for the first element matching the given CSS `selector`.
 * @param {Page} page
 * @param {string} selector
 * @param {string} attr element attribute, e.g. "title"
 * @returns {string}
 */
export function getElementAttribute(page, selector, attr) {
    return page.$eval(selector, (node, attr) => node.getAttribute(attr), attr);
}

/**
 * Returns the value of `attr` for all elements matching the given CSS `selector`.
 * @param {Page} page
 * @param {string} selector
 * @param {string} attr element attribute, e.g. "title"
 * @returns {string}
 */
export function getElementsAttribute(page, selector, attr) {
    return page.$$eval(selector, (nodes, attr) => nodes.map(node => node.getAttribute(attr)), attr);
}

/**
 * Returns the innerHTML property for the element matching the given CSS `selector`.
 * @param {Page} page
 * @param {string} selector
 * @returns {string[]} innerHTML
 */
export function getElementInnerHtml(page, selector) {
    return page.$eval(selector, node => node.innerHTML);
}
/**
 * Returns the innerText property for the element matching the given CSS `selector`.
 * @param {Page} page
 * @param {string} selector
 * @returns {string[]} innerText
 */
export function getElementInnerText(page, selector) {
    return page.$eval(selector, node => node.innerText);
}

/**
 * Returns the innerHTML property for all elements matching the given CSS `selector`.
 * @param {Page} page
 * @param {string} selector
 * @returns {string[]} innerHTML
 */
export function getElementsInnerHtml(page, selector) {
    return page.$$eval(selector, nodes => nodes.map(node => node.innerHTML));
}

/**
 * Takes a screenshot of `t.context.page` and saves it in directory `path`.
 */
export async function takeTestScreenshot(t, path) {
    await mkdir(path, { recursive: true });
    const width = await t.context.page.evaluate(() => window.innerWidth);
    const height =
        (await t.context.page.$eval('.dw-chart-styles', d => {
            let h = 0;
            for (const el of d.children) h += el.clientHeight || 0;
            return h;
        })) + 10;
    await t.context.page.setViewport({ deviceScaleFactor: 3, width, height });
    await t.context.page.screenshot({
        path: join(path, `${slugify(t.title.split('hook for')[1])}.png`)
    });
}

async function getThemeDataDark(themeData) {
    const themeDark = { data: cloneDeep(themeData) };

    // automatically invert colors
    const themeSchema = schemas.getSchemaJSON('themeData');
    const { darkBg, origBg } = getBackgroundColors(themeDark);
    await convertToDarkMode(themeSchema, { theme: themeDark, origBg, darkBg });

    // emulating functionality in API
    // https://github.com/datawrapper/code/blob/ba88779294ea9363f692fc51bdaa102a47a13101/services/api/src/routes/themes/%7Bid%7D/index.js#LL368-L387
    set(themeDark.data, '_computed.bgLight', get(themeData, 'colors.background', '#ffffff'));
    set(themeDark.data, '_computed.bgDark', get(themeDark.data, 'colors.background', '#ffffff'));
    set(themeDark.data, '_computed.origGradients', get(themeData, 'colors.gradients', []));
    return themeDark.data;
}

/*
 * Updates the chart with new metadata (merged with existing) and re-renders
 * @param {Page} page
 * @param {oject} updatedProps
 */
export async function updateMetadata(page, updatedProps) {
    await page.evaluate(async updatedProps => {
        const merge = (target, source) => {
            // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
            for (const key of Object.keys(source)) {
                if (source[key] instanceof Object)
                    Object.assign(source[key], merge(target[key], source[key]));
            }
            // Join `target` and modified `source`
            Object.assign(target || {}, source);
            return target;
        };

        const newMetadata = merge(window.__dw.vis.chart().get().metadata, updatedProps);

        window.__dw.vis.chart().set('metadata', newMetadata);

        await window.__dw.vis.chart().load(window.__dw.params.data);

        // re-render
        window.__dw.render();
    }, updatedProps);
}
