<svelte:options tag={null} />

<script>
    import createEmotion from '@emotion/css/create-instance';
    import Visualization from './Visualization.svelte';
    import { loadScript } from '@datawrapper/shared/fetch.js';
    const DEPENDENCY_STATE = {
        loading: 'loading',
        finished: 'finished'
    };
    export let dependencyStates = {};
    export let dependencies = [];
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
    export let outerContainer;
    export let themeCSSDark;
    export let isAutoDark;
    export let renderFlags = {}; // allow passing render flags directly

    let stylesLoaded = false;
    let dependenciesLoaded = false;
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
        // fonts need to be appended globally, and can then be used in every WebComponent
        if (chart.theme) {
            const styleId = `datawrapper-${chart.theme}`;
            if (typeof document !== 'undefined') {
                if (!document.head.querySelector(`#${styleId}`)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    style.type = 'text/css';
                    style.innerHTML = theme.fontsCSS;
                    document.head.appendChild(style);
                }
            }
        }
    }
    async function loadDependency(script) {
        if (!dependencyStates[script]) {
            dependencyStates[script] = DEPENDENCY_STATE.loading;
            await loadScript(script.indexOf('http') === 0 ? script : `${origin}/${script}`);
            dependencyStates[script] = DEPENDENCY_STATE.finished;
        }
        if (dependencyStates[script] === DEPENDENCY_STATE.finished) {
            window.datawrapper.dependencyCompleted();
        }
    }

    window.datawrapper.onDependencyCompleted(function () {
        for (const script of dependencies) {
            if (dependencyStates[script] !== DEPENDENCY_STATE.finished) {
                if (!dependencyStates[script]) {
                    loadDependency(script);
                }
                return;
            }
        }
        dependenciesLoaded = true;
    });

    $: {
        if (dependencies.length) loadDependency(dependencies[0]);
    }
</script>

<div bind:this={styleHolder} />

<div class="web-component-body">
    {#if stylesLoaded && dependenciesLoaded}
        <div class="chart dw-chart vis-{chart.type}" class:dir-rtl={textDirection === 'rtl'}>
            <Visualization
                {data}
                {chart}
                {visualization}
                {theme}
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
            />
        </div>
    {/if}
</div>
