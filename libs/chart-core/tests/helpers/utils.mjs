import { readFile } from 'fs/promises';
import { URL } from 'url';
import { join } from 'path';
import { setTimeout } from 'timers/promises';
import puppeteer from 'puppeteer';
import { QueryHandler } from 'query-selector-shadow-dom/plugins/puppeteer/index.js';
import {
    createBrowser,
    createPage,
    createPageWebComponent,
    render,
    renderAsWebComponent,
    takeTestScreenshot
} from './setup.mjs';

const __dirname = new URL('.', import.meta.url).pathname;
const DEBUG = process.env.DEBUG;

const visMeta = {
    id: 'dummy',
    __plugin: 'dummy',
    axes: {}
};

export async function before(t) {
    t.context.translations = {};

    t.context.browser = await createBrowser({
        devtools: DEBUG
    });
}

export async function beforeWC(t) {
    // register shadow/ query handler
    await puppeteer.registerCustomQueryHandler('shadow', QueryHandler);
    await before(t);
}

export async function beforeEach(t) {
    t.context.page = await createPage(t.context.browser);
    const js = await readFile(join(__dirname, 'data/dummy.vis.js'), 'utf-8');
    await Promise.all([t.context.page.addScriptTag({ content: js })]);
}

export async function beforeEachWC(t) {
    t.context.webComponent = true;
    t.context.page = await createPageWebComponent(t.context.browser);
    // const js = await readFile(join(__dirname, 'data/dummy.vis.js'), 'utf-8');
    // await Promise.all([t.context.page.addScriptTag({ content: js })]);
}

export async function after(t) {
    await t.context.browser.close();
}

export async function afterEach(t, testPath = './tests') {
    if (!t.passed) {
        const bodySelector = t.context.webComponent ? 'shadow/.dw-chart-styles' : 'body';
        console.error({
            body: await t.context.page.$eval(bodySelector, n => n.innerHTML.trim())
        });
        await takeTestScreenshot(t, join(testPath, 'failed'));
    }
    if (DEBUG) await setTimeout(60000);
    await t.context.page.close();
}

export async function renderDummy(t, props) {
    const { page, translations } = t.context;
    if (!props.chart)
        props.chart = {
            metadata: { axes: {} }
        };
    props.chart.type = 'dummy';
    props.chart.theme = props.chart.theme || 'test';
    if (!props.dataset) props.dataset = 'label,value';

    return await (props.webComponent ? renderAsWebComponent : render)(page, {
        ...props,
        visMeta,
        translations
    });
}
