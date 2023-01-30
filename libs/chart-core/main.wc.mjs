import { parseFlagsFromElement } from './lib/shared.mjs';
import VisualizationWebComponent from './lib/VisualizationWebComponent.wc.svelte';

if (!window.datawrapper) {
    window.datawrapper = {
        dependencyStates: {},
        dependencyCallbacks: [],
        onDependencyCompleted(cb) {
            window.datawrapper.dependencyCallbacks.push(cb);
        },
        dependencyCompleted() {
            for (const cb of window.datawrapper.dependencyCallbacks) {
                cb();
            }
        },
        async render(data) {
            // get the source script element
            // eslint-disable-next-line
            data.script = document.currentScript;
            data.origin = (data.script.getAttribute('src') || '').split('/').slice(0, -1).join('/');

            // create target element
            const elementId = `datawrapper-vis-${data.chart.id}`;
            const target = document.createElement('div');
            target.setAttribute('id', elementId);
            data.script.parentNode.insertBefore(target, data.script);

            // @todo: support automatic dark mode initialization
            const renderFlags = parseFlagsFromElement(data.script);
            const props = {
                target,
                props: {
                    outerContainer: target,
                    dependencyStates: window.datawrapper.dependencyStates,
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
