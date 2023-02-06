import test from 'ava';
import { before, beforeEach, after, afterEach, renderDummy } from '../helpers/utils.mjs';
import {
    getElementAttribute,
    getElementBoundingBox,
    getElementInnerText
} from '../helpers/setup.mjs';
import { setTimeout } from 'timers/promises';

test.before(before);
test.beforeEach(beforeEach);
test.afterEach.always(afterEach);
test.after(after);

const dummyLogo = 'https://dummyimage.com/60x30/e6335f/ffffff.png&text=logo';

const themeData = {
    options: {
        blocks: {
            logo: {
                data: {
                    options: [
                        { id: 'l1', title: 'ACME Logo', text: 'ACME' },
                        {
                            id: 'l2',
                            title: 'ACME Logo 2',
                            text: 'FooBar',
                            url: 'http://example.com',
                            linkTitle: 'Click me'
                        },
                        {
                            id: 'l3',
                            title: 'Logo with image',
                            imgSrc: dummyLogo,
                            height: 30,
                            altText: 'Logo Image'
                        }
                    ]
                }
            }
        }
    }
};

test('use first logo by default', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        chart: {
            title: 'I have a logo',
            metadata: {
                describe: { byline: 'Datawrapper' },
                publish: { blocks: { logo: { enabled: true } } }
            }
        },
        themeData
    });
    t.is(await getElementInnerText(page, '.footer-right .logo-block'), 'ACME');
});

test('set logoId in metadata', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        chart: {
            title: 'I have a logo',
            metadata: {
                describe: { byline: 'Datawrapper' },
                publish: { blocks: { logo: { enabled: true, id: 'l2' } } }
            }
        },
        themeData
    });
    t.is(await getElementInnerText(page, '.footer-right .logo-block'), 'FooBar');
    t.is(
        await getElementAttribute(page, '.footer-right .logo-block a', 'href'),
        'http://example.com'
    );
    t.is(await getElementAttribute(page, '.footer-right .logo-block a', 'title'), 'Click me');
});

test('force logoId via render flag', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        flags: { logoId: 'l2' },
        chart: {
            title: 'I have a logo',
            metadata: {
                describe: { byline: 'Datawrapper' },
                publish: { blocks: { logo: { enabled: true, id: 'l1' } } }
            }
        },
        themeData
    });
    t.is(await getElementInnerText(page, '.footer-right .logo-block'), 'FooBar');
});

test('image logo with alt tag', async t => {
    const { page } = t.context;
    await renderDummy(t, {
        flags: { logoId: 'l3' },
        chart: {
            title: 'I have a logo',
            metadata: {
                describe: { byline: 'Datawrapper' },
                publish: { blocks: { logo: { enabled: true } } }
            }
        },
        themeData
    });
    t.is(await getElementAttribute(page, '.footer-right .logo-block img', 'src'), dummyLogo);
    t.is(await getElementAttribute(page, '.footer-right .logo-block img', 'alt'), 'Logo Image');
    await setTimeout(500);
    const bbox = await getElementBoundingBox(page, '.footer-right .logo-block img');
    t.is(bbox.width, 60);
    t.is(bbox.height, 30);
});
