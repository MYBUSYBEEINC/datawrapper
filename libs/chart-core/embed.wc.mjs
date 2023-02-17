import { parseFlagsFromElement } from './lib/shared/parseFlags.mjs';
import { loadScript } from '@datawrapper/shared/fetch.js';

const chartData = {};
// we keep the dependency promises global so we only load them once per page
const dependencyPromises = {};

if (!window.datawrapper) {
    window.datawrapper = {
        chartData,
        async render(data, opts = {}) {
            // get the source script element
            // eslint-disable-next-line
            data.script = document.currentScript;
            const origin = opts.origin || (data.chart.publicUrl || '').replace(/\/$/, '');

            // store render data for later use
            window.datawrapper.chartData[data.chart.id] = Promise.resolve(data);

            // create target element
            const elementId = `datawrapper-vis-${data.chart.id}`;

            const target = opts.target || document.createElement('div');
            target.setAttribute('id', elementId);
            if (!opts.target) {
                data.script.parentNode.insertBefore(target, data.script);
            }
            // @todo: support automatic dark mode initialization
            const renderFlags = opts.flags || parseFlagsFromElement(data.script);
            const props = {
                target,
                props: {
                    outerContainer: target,
                    dependencyPromises: window.datawrapper.dependencyPromises,
                    renderFlags,
                    isAutoDark:
                        renderFlags.dark === 'auto' ||
                        (renderFlags.dark !== true &&
                            renderFlags.dark !== false &&
                            data.chartAutoDark),
                    ...data
                },
                hydrate: false
            };
            const loadDependency = async script => {
                if (!dependencyPromises[script]) {
                    dependencyPromises[script] = loadScript(
                        script.indexOf('http') === 0 ? script : `${origin}/${script}`
                    );
                }
                return dependencyPromises[script];
            };
            // first we're loading the "root" dependency dw-2.0.js
            // which is needed before we can load the remaining scripts
            const [dwjs, visComp, ...otherDeps] = data.dependencies;
            await Promise.all([loadDependency(dwjs), loadDependency(visComp)]);
            // now load the remaining dependencies
            await Promise.all(otherDeps.map(src => loadDependency(src)));

            const { VisualizationWebComponent } = window.datawrapper;

            if (!customElements.get('datawrapper-visualization')) {
                customElements.define('datawrapper-visualization', VisualizationWebComponent);
                new VisualizationWebComponent(props);
            } else {
                const WebComponent = customElements.get('datawrapper-visualization');
                new WebComponent(props);
            }
        }
    };
}
