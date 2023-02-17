const FLAG_BOOL_FALSE = new Set(['0', 'false', 'null']);

const RENDER_FLAG_TYPES = {
    allowEditing: Boolean,
    dark: BooleanWithAuto,
    fitchart: Boolean,
    fitheight: Boolean,
    logo: String,
    logoId: String,
    map2svg: Boolean,
    plain: Boolean,
    previewId: String,
    search: String,
    static: Boolean,
    svgonly: Boolean,
    theme: String,
    transparent: Boolean
};

/**
 * Like StringBoolean, but also supports the 'auto' value
 * @param {string} val
 * @returns {Boolean|'auto'|''}
 */
function BooleanWithAuto(val) {
    if (val === 'auto') return val;
    return !!val && !FLAG_BOOL_FALSE.has(val);
}

function parseFlags(getValue, flagTypes = RENDER_FLAG_TYPES) {
    return Object.fromEntries(
        Object.entries(flagTypes).map(([key, type]) => {
            const val = getValue(key);
            if (type === Boolean) {
                return [key, !!val && !FLAG_BOOL_FALSE.has(val)];
            }
            return [key, val && type(val)];
        })
    );
}

export function parseFlagsFromElement(el, flagTypes = RENDER_FLAG_TYPES) {
    return parseFlags(key => el.getAttribute(`data-${key}`), flagTypes);
}

export function parseFlagsFromURL(searchString, flagTypes = RENDER_FLAG_TYPES) {
    const urlParams = new URLSearchParams(searchString);
    return parseFlags(key => urlParams.get(key), flagTypes);
}

// used in test setup
export function parseFlagsFromObject(obj, flagTypes = RENDER_FLAG_TYPES) {
    return parseFlags(key => obj[key], flagTypes);
}
