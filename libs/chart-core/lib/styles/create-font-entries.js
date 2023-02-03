module.exports = { createFontEntries };

function createFontEntries(fonts, themeData) {
    const usedFonts = [];
    const fontEntries = [];

    if (themeData && themeData.typography && themeData.typography.fontFamilies) {
        Object.entries(themeData.typography.fontFamilies).forEach(([fontFamily, familyFonts]) => {
            familyFonts.forEach(props => {
                if (fonts[props.name] && !props.printOnly) {
                    usedFonts.push(props.name);
                    fontEntries.push({
                        family: fontFamily,
                        css: `${createFontCSS(fontFamily, fonts[props.name].files, props)}`
                    });
                }
            });
        });
    }

    Object.entries(fonts).forEach(([font, attr]) => {
        switch (attr.method) {
            case 'file':
            case 'url':
                if (!usedFonts.includes(font)) {
                    fontEntries.push({ family: font, css: `${createFontCSS(font, attr.files)}` });
                }
                break;
            case 'import':
                fontEntries.unshift({ family: font, css: `@import '${processUrl(attr.import)}';` });
                break;
            default:
                break;
        }
    });

    return fontEntries;

    function processUrl(url) {
        if (url.substring(0, 2) === '//') {
            return `https:${url}`;
        } else {
            return url;
        }
    }

    function createFontCSS(font, fileFormats, props = {}) {
        const sanitizedFont = font.replace(/'/g, "\\'");
        props = { display: 'auto', ...props };
        const fmtMap = { ttf: 'truetype', otf: 'opentype' };

        const fontUrls = Object.entries(fileFormats)
            .filter(([format]) => !['eot', 'woff2'].includes(format))
            .map(([f, v]) => {
                const fmt = fmtMap[f] || f;
                return `url('${processUrl(v)}${
                    f === 'svg' ? `#${sanitizedFont}` : ''
                }') format('${fmt}')`;
            });

        const propsCSS = ['weight', 'style', 'display', 'stretch']
            .filter(prop => props[prop])
            .map(prop => `font-${prop}: ${props[prop]};`);

        return `@font-face {
    font-family: ${sanitizedFont};
    ${propsCSS.join('\n\t')}
    src: ${fontUrls.join(',\n\t\t ')};
}`;
    }
}
