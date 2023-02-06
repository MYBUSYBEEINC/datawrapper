import test from 'ava';
import { getElementInnerHtml, getElementStyle } from '../helpers/setup.mjs';
import { beforeWC, beforeEachWC, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import { setTimeout } from 'timers/promises';

test.before(beforeWC);
test.beforeEach(beforeEachWC);
test.afterEach.always(afterEach);
test.after(after);

test('load web fonts defined in theme', async t => {
    const { page } = t.context;

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {}
            }
        },
        themeData: {
            typography: {
                headline: { typeface: 'Foobar' }
            }
        },
        themeFonts: {
            Foobar: {
                type: 'font',
                files: {
                    eot: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.eot',
                    svg: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.svg',
                    ttf: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.ttf',
                    woff: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff',
                    woff2: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff2'
                },
                method: 'file'
            }
        }
    });

    t.is(await getElementStyle(page, 'shadow/.dw-chart-header h3 span', 'font-family'), 'Foobar');
    t.not(await getElementInnerHtml(page, 'style#datawrapper-test'), '');
    t.is(await page.evaluate(() => document.fonts.check('16px Foobar')), true);
});

test('dont load web fonts alread loaded in page', async t => {
    const { page } = t.context;

    t.is(await page.evaluate(() => document.fonts.check('16px Another')), false);

    await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.fontFamily = 'Another';
        div.innerText = 'test';
        document.body.appendChild(div);
    });
    await page.addStyleTag({
        content: `@font-face {
       font-family: Another;
       font-display: auto;
       src: url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.svg#Another) format('svg'),
   		 url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.ttf) format('truetype'),
   		 url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff) format('woff');
   }`
    });

    await setTimeout(1500);
    t.is(await page.evaluate(() => document.fonts.check('16px Another')), true);

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {}
            }
        },
        themeData: {
            typography: {
                headline: { typeface: 'Another' }
            }
        },
        themeFonts: {
            Another: {
                type: 'font',
                files: {
                    eot: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.eot',
                    svg: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.svg',
                    ttf: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.ttf',
                    woff: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff',
                    woff2: '//static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff2'
                },
                method: 'file'
            }
        }
    });

    t.is(await getElementInnerHtml(page, 'style#datawrapper-test'), '');
});

test('load multi-family web font if not all families are loaded in page', async t => {
    const { page } = t.context;

    t.is(await page.evaluate(() => document.fonts.check('16px Another')), false);

    await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.fontFamily = 'Another';
        div.innerText = 'test';
        document.body.appendChild(div);
    });
    await page.addStyleTag({
        content: `@font-face {
       font-family: Another;
       font-display: auto;
       src: url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.svg#Another) format('svg'),
   		 url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.ttf) format('truetype'),
   		 url(https://static.dwcdn.net/custom/themes/chl/Roboto-Regular/Roboto-Regular.woff) format('woff');
   }`
    });

    await setTimeout(1500);
    t.is(await page.evaluate(() => document.fonts.check('16px Another')), true);

    await renderDummy(t, {
        webComponent: true,
        chart: {
            title: 'Hello world',
            metadata: {
                visualize: {}
            }
        },
        themeData: {
            typography: {
                headline: { typeface: 'Another' }
            }
        },
        themeFonts: {
            Another: {
                type: 'font',
                import: 'https://static.dwcdn.net/css/roboto.css',
                families: ['Another', 'One More'],
                method: 'import'
            }
        }
    });

    t.not(await getElementInnerHtml(page, 'style#datawrapper-test'), '');
});
