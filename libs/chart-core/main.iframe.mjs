import VisualizationIframe from './lib/VisualizationIframe.svelte';
import createEmotion from '@emotion/css/create-instance';
import { parseFlagsFromURL } from './lib/shared.mjs';

function render() {
    const target = document.getElementById('__svelte-dw');
    const { chart, published, chartAutoDark } = window.__DW_SVELTE_PROPS__;
    const emotion = createEmotion({
        key: `datawrapper-${chart.id}`,
        container: document.head
    });

    const flagsFromURL = parseFlagsFromURL(window.location.search);

    // the only time when renderFlags are already defined in __DW_SVELTE_PROPS__
    // is in render unit tests, where we don't want to have to set a URL query
    const overrideFlags = window.__DW_SVELTE_PROPS__.renderFlags || {};

    /*
     * we're overwriting the dark renderFlag in order to support automatic dark
     */
    const autoDark =
        overrideFlags.dark === 'auto' || // render-tests may enforce auto dark-mode
        flagsFromURL.dark === 'auto' || // url flags may enforce auto dark-mode
        // the chart/theme-based auto dark mode is only available in published charts
        (flagsFromURL.dark === null && published && chartAutoDark === true);

    const isDark =
        overrideFlags.dark === true ||
        flagsFromURL.dark === true ||
        (autoDark &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) document.getElementById('__svelte-dw').className += ' is-dark-mode';

    if (autoDark) {
        removeHideStyles();
    } else {
        if (isDark) {
            document.getElementById('css-light').setAttribute('media', '--disabled--');
            document.getElementById('css-dark').removeAttribute('media');
            document.head.querySelector('meta[name="color-scheme"]').content = 'dark';
        } else {
            document.getElementById('css-dark').setAttribute('media', '--disabled--');
            document.getElementById('css-light').removeAttribute('media');
            document.head.querySelector('meta[name="color-scheme"]').content = 'light';
        }
        removeHideStyles();
    }
    // override initial dark flag
    overrideFlags.dark = isDark;
    window.__DW_SVELTE_PROPS__.isAutoDark = autoDark;

    function removeHideStyles() {
        const st = document.getElementById('hide-all');
        if (st) st.parentNode.removeChild(st);
    }

    /* eslint-disable no-new */
    new VisualizationIframe({
        target,
        props: {
            ...window.__DW_SVELTE_PROPS__,
            outerContainer: target,
            renderFlags: { ...flagsFromURL, ...overrideFlags },
            emotion
        },
        hydrate: true
    });
}
if (window.dw) {
    window.dw.scriptLoaded = true;
}
render();
