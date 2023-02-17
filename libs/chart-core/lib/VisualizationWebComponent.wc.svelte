<svelte:options tag={null} />

<script>
    import createEmotion from '@emotion/css/create-instance';

    import { createFontEntries } from './styles/create-font-entries.js';
    import { resize } from 'svelte-resize-observer-action';
    import debounce from 'lodash/debounce.js';
    import some from 'lodash/some.js';
    import { parseFlagsFromElement } from './shared/parseFlags.mjs';
    import { getChartIdFromUrl, getEmbedJsonUrl } from './shared/urls.mjs';
    import Visualization from './Visualization.svelte';

    export let data = '';
    export let chart = {};
    export let visualization = {};
    export let theme = {};
    export let themeDataDark = {};
    export let themeDataLight = {};
    export let locales = {};
    export let textDirection = 'ltr';
    export let translations;
    export let blocks = {};
    export let chartAfterBodyHTML = '';
    export let isPreview;
    export let assets;
    export let styles;
    export let origin = '';
    export let fonts = {};
    export let themeFonts = {};
    export let outerContainer;
    export let themeCSSDark;
    export let isAutoDark;
    export let renderFlags = {}; // allow passing render flags directly

    let stylesLoaded = false;
    let styleHolder;
    let emotion;

    // ensure styles are loaded before the vis is rendered to prevent flickering
    $: {
        if (typeof document !== 'undefined') {
            if (!stylesLoaded && styleHolder && styles) {
                // light styles
                const styleLight = document.createElement('style');
                styleLight.id = 'css-light';
                styleLight.textContent = styles;
                styleLight.media = '(prefers-color-scheme: light)';
                styleHolder.appendChild(styleLight);
                // dark styles
                const styleDark = document.createElement('style');
                styleDark.id = 'css-dark';
                styleDark.media = '(prefers-color-scheme: dark)';
                styleDark.textContent = themeCSSDark;
                styleHolder.appendChild(styleDark);

                emotion = createEmotion({
                    key: `datawrapper-${chart.id}`,
                    container: styleHolder
                });
                stylesLoaded = true;
            }
        }
    }
    $: {
        // fonts need to be loaded globally, and can then be used in every WebComponent
        if (chart.theme) {
            const styleId = `datawrapper-${chart.theme}`;
            if (typeof document !== 'undefined') {
                if (!document.head.querySelector(`#${styleId}`)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    const skipExistingFonts =
                        document.fonts &&
                        document.fonts.check &&
                        // browsers may decide not to reveal whether or not a font is installed to limit
                        // fingerprinting. we're finding out if this is the case by checking for a font
                        // name that definitely doesn't exist
                        !document.fonts.check('16px fNECMNZabqSjpxnZRdS');
                    const fontsCSS = createFontEntries(themeFonts, themeDataLight)
                        .filter(
                            d =>
                                !skipExistingFonts ||
                                some(
                                    d.families || [d.family],
                                    family => !document.fonts.check(`16px ${family}`)
                                )
                        )
                        .map(d => d.css)
                        .join('\n');
                    style.textContent = fontsCSS;
                    document.head.appendChild(style);
                }
            }
        }
    }

    let containerWidth;
    let containerHeight;

    function onResize(entry) {
        containerWidth = entry.contentRect.width;
        if (entry.contentRect.height) containerHeight = entry.contentRect.height;
    }

    let wcBody;

    async function fixLinks() {
        // fix for links with target="_self"
        for (const link of wcBody.querySelectorAll('a[target=_self]')) {
            const chartId = getChartIdFromUrl(link.href);

            if (
                chartId &&
                outerContainer.nextSibling &&
                outerContainer.nextSibling.nodeName.toLowerCase() === 'script'
            ) {
                const script = outerContainer.nextSibling;
                const { url: embedJSONUrl, pathPrefix } = getEmbedJsonUrl(script.src, chartId);

                if (!window.datawrapper.chartData[chartId]) {
                    window.datawrapper.chartData[chartId] = (async function () {
                        const res = await fetch(embedJSONUrl, { mode: 'cors' });
                        const body = await res.json();
                        return body;
                    })();
                }

                link.addEventListener('click', async event => {
                    const data = await window.datawrapper.chartData[chartId];
                    // remove existing chart markup
                    // @todo: this does not remove event handlers, so a better way would
                    // be to have some sort of controlled self-destruction
                    outerContainer.innerHTML = '';
                    window.datawrapper.render(data, {
                        target: outerContainer,
                        origin: `${pathPrefix}${chartId}`,
                        flags: parseFlagsFromElement(link)
                    });
                    event.preventDefault();
                    return false;
                });
            }
        }
    }
</script>

<div bind:this={styleHolder} />

<div
    bind:this={wcBody}
    use:resize={debounce(onResize, 200)}
    class="web-component-body"
    style="position:relative"
>
    {#if stylesLoaded}
        <div class="chart dw-chart vis-{chart.type}" class:dir-rtl={textDirection === 'rtl'}>
            <Visualization
                {data}
                {chart}
                {visualization}
                {theme}
                {themeFonts}
                {themeDataDark}
                {themeDataLight}
                {locales}
                {translations}
                {blocks}
                {chartAfterBodyHTML}
                isIframe={false}
                {isPreview}
                {isAutoDark}
                {assets}
                {origin}
                {fonts}
                {styleHolder}
                {outerContainer}
                {emotion}
                {renderFlags}
                {textDirection}
                {containerWidth}
                {containerHeight}
                on:rendered={fixLinks}
            />
        </div>
    {/if}
</div>
