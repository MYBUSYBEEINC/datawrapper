'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var chroma = require('chroma-js');
var invertColor = require('@datawrapper/shared/invertColor.js');
var get = require('lodash/get.js');
var set = require('lodash/set.js');
var deepmerge = require('deepmerge');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var chroma__default = /*#__PURE__*/_interopDefaultLegacy(chroma);
var invertColor__default = /*#__PURE__*/_interopDefaultLegacy(invertColor);
var get__default = /*#__PURE__*/_interopDefaultLegacy(get);
var set__default = /*#__PURE__*/_interopDefaultLegacy(set);
var deepmerge__default = /*#__PURE__*/_interopDefaultLegacy(deepmerge);

/**
 * merges all overrides for which the provided filter function returns true
 *
 * @param {object} theme
 * @param {(override:object) => boolean|null} filterFunc
 * @returns
 */
function mergeOverrides(theme, filterFunc) {
    const merged = {};
    get__default["default"](theme.data, 'overrides', []).forEach(({ type, settings, condition }) => {
        if (!filterFunc || filterFunc({ type, settings, condition })) {
            Object.entries(settings).forEach(([key, value]) => {
                set__default["default"](merged, key, value);
            });
        }
    });
    return merged;
}

/**
 * converts all colors in a theme that are white-listed for auto dark-mode
 * conversion.
 *
 * @param {object} themeSchema - the JSON build of the themeData schemas
 * @param {object} opts
 * @param {object} opts.theme - the theme to invert
 * @param {string} opts.origBg - the original "light" background
 * @param {string} opts.darkBg - the dark background
 * @return {object} the inverted theme
 */
async function convertToDarkMode(themeSchema, { theme, origBg, darkBg }) {
    // get "global" dark mode override settings, defined in un-conditional overrides
    const darkMode = mergeOverrides(theme, d => d.type === 'darkMode' && !d.condition);
    const themeColorKeys = await findDarkModeOverrideKeys(themeSchema, theme);

    themeColorKeys.forEach(({ path: key, noInvert, isHexColorAndOpacity }) => {
        const darkThemeVal = get__default["default"](darkMode, key);
        // there are 3 different ways we will invert theme values
        if (isHexColorAndOpacity) {
            // special treatment for colors with opacity, e.g. `{ color: '#ff0000', opacity: 0.5 }`
            setThemeValue(oldVal => invertHexColorAndOpacity(oldVal));
        } else if (darkThemeVal) {
            // theme defines an un-conditional darkmode override for this key
            // which we will use instead of auto-inverted colors,...
            const globalVal = get__default["default"](theme.data, key);
            setThemeValue(lightVal =>
                // ...except if the "light" value defined in an override is different
                // from the global light value of that key, in which case we auto-invert
                // unless `noInvert` is set, in which case we do nothing
                globalVal === lightVal
                    ? darkThemeVal
                    : noInvert
                    ? null
                    : convertColorOrArray(lightVal)
            );
        } else {
            // not a { color, opacity } pair and no global darkMode override defined
            // so we can just use the normal inver
            setThemeValue(oldVal => {
                if (oldVal && !noInvert) {
                    return convertColorOrArray(oldVal);
                } else if (key === 'colors.chartContentBaseColor') {
                    return '#eeeeee';
                }
            });
        }

        /**
         * convert a color or an array of colors to dark mode
         * @param {string|string[]} color - the input color or an array of colors
         * @returns {string|string[]}
         */
        function convertColorOrArray(color) {
            return Array.isArray(color)
                ? color.map(convertColor)
                : typeof color === 'string' && color.includes(' ')
                ? color
                      .split(' ')
                      .map(part => (chroma__default["default"].valid(part) ? convertColor(part) : part))
                      .join(' ')
                : convertColor(color);
        }

        /**
         * convert a light mode color to dark mode (inverting)
         * @param {string} lightColor
         * @returns
         */
        function convertColor(lightColor) {
            if (!chroma__default["default"].valid(lightColor)) return lightColor;
            const lightContrast = chroma__default["default"].contrast(origBg, lightColor);
            return invertColor__default["default"](
                lightColor,
                darkBg,
                origBg,
                0.85 -
                    // boost text contrast if old text contrast was low already
                    (lightContrast < 8 && (key.includes('typography') || key.includes('text'))
                        ? 0.2
                        : 0)
            );
        }

        /**
         * converts a color given as {color,opacity} pair to dark mode
         *
         * @param {object} colorAndOpacity
         * @param {string} colorAndOpacity.color
         * @param {number} colorAndOpacity.opacity
         * @returns {object} a {color?, opacity?} pair
         */
        function invertHexColorAndOpacity(colorAndOpacity = {}) {
            const { color, opacity } = colorAndOpacity;
            let darkModeVal = get__default["default"](darkMode, key);
            if (!darkModeVal && color && typeof opacity !== 'undefined') {
                // we don't have an explicit global darkMode override, and the opacity is defined
                const alphaColor = chroma__default["default"](color).alpha(opacity).hex();
                const inverted = chroma__default["default"](invertColor__default["default"](alphaColor, darkBg, origBg, 0.85));
                // split color and opacity after inverting
                darkModeVal = {
                    color: inverted.alpha(1).hex(),
                    opacity: inverted.alpha()
                };
            } else {
                // check if the darkMode override has either opacity or color set
                // and use whatever we have. This allows themes to use the auto-inverted
                // color, but set an explicit opacity to be used in dark mode
                if (!darkModeVal) darkModeVal = {};
                if (!('opacity' in darkModeVal) && typeof opacity !== 'undefined') {
                    darkModeVal.opacity = opacity;
                } else if (!darkModeVal.color && color) {
                    darkModeVal.color = invertColor__default["default"](color, darkBg, origBg, 0.85);
                }
            }
            return darkModeVal;
        }

        /**
         * Instead of simply setting the inverted value, we need to also check
         * if an non-darkMode (aka light mode) override for the same key exists.
         * In that case, we need to invert the value defined in the override settings
         * as well.
         *
         * @param {(color:string) => string} invertValue - a function to invert the given value
         */
        function setThemeValue(invertValue) {
            // first set normal value
            const newVal = invertValue(get__default["default"](theme.data, key));
            if (newVal) set__default["default"](theme.data, key, newVal);
            // then look through non-darkMode overrides and also update value
            (theme.data.overrides || [])
                .filter(od => od.condition && od.type !== 'darkMode')
                .forEach(({ settings }) => {
                    if (settings[key] !== undefined) {
                        const newVal = invertValue(settings[key]);
                        if (newVal) settings[key] = newVal;
                    }
                });
        }
    });

    set__default["default"](theme, 'data.colors.background', darkBg);
    const bodyBackground = get__default["default"](theme, 'data.style.body.background', 'transparent');
    if (bodyBackground !== 'transparent' && chroma__default["default"](bodyBackground).hex() === chroma__default["default"](origBg).hex()) {
        set__default["default"](theme, 'data.style.body.background', darkBg);
    }
}
/**
 * returns the original background color as well as its lumincance
 * along with the inverted or user-defined background color for the theme
 *
 * @param {object} theme
 * @returns {{ darkBg: string, origBg: string, origBgLum: number }}
 */
function getBackgroundColors(theme) {
    const origBg = get__default["default"](
        theme.data,
        'colors.background',
        get__default["default"](theme.data, 'style.body.background', '#ffffff')
    );
    const origBgLum = chroma__default["default"](origBg).luminance();
    const darkMode = mergeOverrides(theme, d => d.type === 'darkMode' && !d.condition);
    const darkBg =
        origBgLum < 0.3
            ? origBg
            : get__default["default"](
                  darkMode,
                  'colors.background',
                  chroma__default["default"](origBg)
                      .luminance(origBgLum > 0.5 ? 1 - origBgLum : origBgLum * 0.5)
                      .hex()
              );
    return { darkBg, origBg, origBgLum };
}

/**
 * Extracts all color keys from a theme that support dark mode overrides.
 * If the color doesn't overrideExclude it will also be automatically
 * inverted by convertToDarkMode()
 *
 * @param {object} themeSchema the JSON build of the themeData schema
 * @param {object} theme the theme
 * @returns {{ path:string, noInvert:boolean, isHexColorAndOpacity:boolean }[]}
 */
async function findDarkModeOverrideKeys(themeSchema, theme = {}) {
    const keepUnits = new Set(['hexColor', 'cssColor', 'cssBorder', 'hexColorAndOpacity']);
    const out = [];
    const refs = [];

    walk(themeSchema, '');

    function walk(obj, path) {
        if (obj?.shared) refs.unshift(...obj.shared);
        if (obj?.type === 'link') {
            const id = obj.link.ref.path[0];
            const ref = refs.find(({ flags }) => flags.id === id);
            if (obj.whens) {
                const concattedSchemas = obj.whens.map(({ concat }) => concat).filter(Boolean);
                obj = ref;
                concattedSchemas.forEach(concattedSchema => {
                    obj = deepmerge__default["default"](obj, concattedSchema);
                });
            } else {
                obj = ref;
            }
        }
        const isHexColorAndOpacity = obj?.flags?.unit === 'hexColorAndOpacity';

        if (obj?.type === 'object' && !isHexColorAndOpacity) {
            for (const key of Object.keys(obj.keys || {})) {
                walk(obj.keys[key], `${path}${path === '' ? '' : '.'}${key}`);
            }
            const allowedKeys = obj?.patterns?.[0]?.schema?.allow;
            if (allowedKeys) {
                allowedKeys.forEach(key => {
                    walk(obj.patterns[0].rule, `${path}${path === '' ? '' : '.'}${key}`);
                });
            }
        } else {
            const unit = obj?.flags?.unit;
            const metas = obj?.metas || [];

            const overrideInclude = metas.find(d => (d.overrideSupport || []).includes('darkMode'));
            const overrideExclude = metas.find(d => (d.overrideExclude || []).includes('darkMode'));

            if ((keepUnits.has(unit) || overrideInclude) && !overrideExclude) {
                const noInvert = !!metas.find(d => d.noDarkModeInvert);
                const props = { path, noInvert, isHexColorAndOpacity };
                if (path.includes('[i]')) {
                    getArrayKeys(props);
                } else {
                    out.push(props);
                }
            }

            if (obj?.type === 'array') {
                walk(obj?.items?.[0], `${path}[i]`);
            }
        }
    }

    function getArrayKeys(props) {
        const match = props.path.match(/\[i\]/);
        if (match) {
            for (const i in get__default["default"](theme.data, props.path.slice(0, match.index), [])) {
                getArrayKeys({ ...props, path: props.path.replace(/(\[i\])/, `.${i}`) });
            }
        } else {
            out.push(props);
        }
    }
    return [...out];
}

exports.convertToDarkMode = convertToDarkMode;
exports.findDarkModeOverrideKeys = findDarkModeOverrideKeys;
exports.getBackgroundColors = getBackgroundColors;
exports.mergeOverrides = mergeOverrides;
//# sourceMappingURL=darkMode.cjs.js.map
