/* eslint-env browser */

/**
 * Cubic-out easing function.
 * See: https://github.com/Rich-Harris/eases-jsnext/blob/master/src/cubic-out.js
 *
 * @param {number} t - Time value between 0 and 1.
 * @returns {number} - The eased time.
 */
function cubicOut(t) {
    var f = t - 1.0;
    return f * f * f + 1.0;
}

/**
 * Fixed slide transition function.
 * Original: https://github.com/sveltejs/svelte-transitions-slide/blob/master/src/index.js
 *
 * The original slide transition function uses the `css` method to animate the transition.
 * This approach seems to fail quitely when used in a web component/shadow DOM environment. (See: https://github.com/sveltejs/svelte/issues/1825)
 * So instead we use the `tick` property (a function called on every animation frame) to apply the new property values.
 * The performance might be a bit worse, but the approach works in all 'environments'.
 *
 * @param {HTMLElement} node - The node to transition.
 * @param {Object} params - The transition parameters.
 *
 * @returns {Object} - The transition object.
 */
export function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
    const style = getComputedStyle(node);
    const opacity = +style.opacity;
    const height = parseFloat(style.height);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const marginTop = parseFloat(style.marginTop);
    const marginBottom = parseFloat(style.marginBottom);
    const borderTopWidth = parseFloat(style.borderTopWidth);
    const borderBottomWidth = parseFloat(style.borderBottomWidth);

    return {
        delay,
        duration,
        easing,
        tick: t => {
            node.style.overflow = 'hidden';
            node.style.opacity = Math.min(t * 20, 1) * opacity;
            node.style.height = `${t * height}px`;
            node.style.paddingTop = `${t * paddingTop}px`;
            node.style.paddingBottom = `${t * paddingBottom}px`;
            node.style.marginTop = `${t * marginTop}px`;
            node.style.marginBottom = `${t * marginBottom}px`;
            node.style.borderTopWidth = `${t * borderTopWidth}px`;
            node.style.borderBottomWidth = `${t * borderBottomWidth}px`;
        }
    };
}
