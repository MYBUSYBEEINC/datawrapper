import purifyHtml from '@datawrapper/shared/purifyHtml.js';
import get from '@datawrapper/shared/get.js';
import set from '@datawrapper/shared/set.js';
import chroma from 'chroma-js';
import clone from '@datawrapper/shared/clone.js';
import deepmerge from 'deepmerge';
import { all, any, has, identity } from 'underscore';

const DEFAULT_ALLOWED = [
    'a',
    'span',
    'b',
    'br',
    'i',
    'strong',
    'sup',
    'sub',
    'strike',
    'u',
    'em',
    'tt'
];

export function clean(s, alsoAllow = []) {
    return purifyHtml(s, alsoAllow.length ? [...DEFAULT_ALLOWED, ...alsoAllow] : DEFAULT_ALLOWED);
}

export function isTransparentColor(color) {
    return color === 'transparent' || !chroma(color).alpha();
}

/**
 * Resolve logical expressions
 *
 * @param {array} condition - condition expression
 * @param {object} context - context for get expressions
 * @returns {*} resolved value
 */
export function resolveCondition(condition, context) {
    return resolve(condition);
    function resolve(cond) {
        if (Array.isArray(cond)) {
            const op = cond[0];
            if (cond.length >= 2 && op === 'all') return all(cond.slice(1).map(resolve));
            if (cond.length >= 2 && op === 'any') return any(cond.slice(1).map(resolve));
            if (cond.length === 2 && op === '!') return !resolve(cond[1]);
            if (cond.length === 2 && op === 'get') return get(context, cond[1]);
            if (cond.length === 2 && op === 'has') return !!get(context, cond[1]);
            if (cond.length === 2 && op === 'length') return resolve(cond[1]).length;
            if (cond.length === 2 && op === 'stripHtml') return purifyHtml(resolve(cond[1]), []);
            if (cond.length === 3 && op === '==') return resolve(cond[1]) === resolve(cond[2]);
            if (cond.length === 3 && op === '!=') return resolve(cond[1]) !== resolve(cond[2]);
            if (cond.length === 3 && op === '>') return resolve(cond[1]) > resolve(cond[2]);
            if (cond.length === 3 && op === '>=') return resolve(cond[1]) >= resolve(cond[2]);
            if (cond.length === 3 && op === '<') return resolve(cond[1]) < resolve(cond[2]);
            if (cond.length === 3 && op === '<=') return resolve(cond[1]) <= resolve(cond[2]);
            if (cond.length === 3 && op === 'in')
                return resolve(cond[2]).includes(resolve(cond[1]));
            return cond; // normal array
        } else {
            // raw value
            return cond;
        }
    }
}

/**
 * compute themeData with overrides
 *
 * @param {object} themeData - source theme.data object
 * @param {object} context - the chart context to evaluate the override conditions in
 * @returns {object} - themeData with overrides
 */
export function computeThemeData(themeData, context = {}, isStyleDark = false) {
    const themeDataClone = clone(themeData);
    if (themeData.overrides && themeData.overrides.length > 0) {
        for (const override of themeData.overrides) {
            if (
                // general override with condition
                (!override.type && override.condition) ||
                // darkmode override with condition
                (override.type === 'darkMode' && isStyleDark && override.condition)
            ) {
                if (resolveCondition(override.condition, context)) {
                    for (const [key, value] of Object.entries(override.settings)) {
                        if (key.startsWith('overrides.'))
                            throw new Error('overrides may not change overrides');
                        set(themeDataClone, key, value);
                    }
                }
            }
        }
        return themeDataClone;
    }
    return themeDataClone;
}

const UNDEFINED_STYLE = '%UNDEFINED%';

const TYPOGRAPHY_PROPS = {
    color: { prop: 'color' },
    fontWeight: { prop: 'font-weight' },
    fontStretch: { prop: 'font-stretch' },
    typeface: { prop: 'font-family' },
    textTransform: { prop: 'text-transform' },
    letterSpacing: {
        tsf: val => toPixel(val),
        prop: 'letter-spacing'
    },
    fontSize: {
        prop: 'font-size',
        tsf: val => toPixel(val)
    },
    lineHeight: {
        prop: 'line-height',
        tsf: val => lineHeight(val)
    },
    underlined: {
        prop: 'text-decoration',
        tsf: val => (isTrue(val) ? 'underline' : 'none')
    },
    cursive: {
        prop: 'font-style',
        tsf: val => (isTrue(val) ? 'italic' : 'normal')
    }
};

export function getThemeStyleHelpers(emotion, themeData) {
    const cssTemplate = (literals, ...expressions) => {
        let raw = '';
        for (const line of literals) {
            raw += line + (expressions.length ? expressions.shift() : '');
        }
        return raw
            .split('\n')
            .filter(line => line)
            .filter(line => !line.includes(UNDEFINED_STYLE))
            .join('\n');
    };

    function getObjProp(obj, key, _default) {
        return get(obj, key, _default === undefined ? UNDEFINED_STYLE : _default);
    }

    function typography(obj = {}, _default = {}) {
        return Object.entries(TYPOGRAPHY_PROPS)
            .filter(([opt]) => has(obj, opt) || has(_default, opt))
            .map(([opt, { prop, tsf = identity }]) => {
                const val = get(obj, opt, _default[opt]);
                return `${prop}: ${tsf(val)};`;
            })
            .join('\n');
    }

    return {
        getProp: (key, _default) => getObjProp(themeData, key, _default),
        getObjProp,
        typography,
        css: (...args) => emotion.css(cssTemplate(...args)),
        cssTemplate,
        UNDEFINED_STYLE
    };
}

export function toPixel(value) {
    if (value === UNDEFINED_STYLE) return value;
    if (Number.isFinite(value)) return `${value}px`;
    return value;
}

export function lineHeight(value) {
    if (value === UNDEFINED_STYLE) return value;
    return value > 3 ? `${value}px` : String(value);
}

export function isTrue(value) {
    return value === 1 || value === true;
}

export function deepmergeOverwriteArrays(target, source) {
    return deepmerge(target, source, { arrayMerge: (destArr, sourceArr) => sourceArr });
}
