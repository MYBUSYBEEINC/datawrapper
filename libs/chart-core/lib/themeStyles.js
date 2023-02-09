import get from '@datawrapper/shared/get';
import { getThemeStyleHelpers, toPixel, isTrue } from './shared.mjs';
import { cache } from '@emotion/css';
import createCache from '@emotion/cache';
import { serializeStyles } from '@emotion/serialize';
import { omit } from 'underscore';

export function globalStyles(emotion, themeData, isIframe) {
    const { getProp, cssTemplate } = getThemeStyleHelpers(emotion, themeData);
    return cssTemplate`${
        isIframe
            ? `body:not(.transparent) {
        background: ${getProp('style.body.background')};
    }`
            : ``
    }`;
}

export function chartStyles(emotion, themeData, isStyleStatic, isIframe) {
    const { css, getProp, typography } = getThemeStyleHelpers(emotion, themeData);
    const bgCol = getProp('colors.background');
    // @todo: don't make fontWeight a special case
    return css`
        ${typography(omit(get(themeData, 'typography.chart', {}), 'fontWeight'))}
        border-bottom: ${getProp('style.body.border.bottom')};
        border-left: ${getProp('style.body.border.left')};
        border-right: ${getProp('style.body.border.right')};
        border-top: ${getProp('style.body.border.top')};
        margin: ${getProp('style.body.margin', 0)};
        padding: ${getProp('style.body.padding')};
        ${!isIframe ? `background: ${getProp('style.body.background')};` : ''}

        ${isStyleStatic
            ? ''
            : `
                a:not(.link-style-ignore) {
                    ${typography(get(themeData, 'typography.links'), { underlined: false })}
                    border-bottom: ${getProp('style.body.links.border.bottom')};
                    padding: ${getProp('style.body.links.padding')};
                }

                a:not(.link-style-ignore):hover {
                    color: ${getProp('typography.links.hoverColor')};
                }
        `}

        .labels text,
        .label {
            font-size: ${toPixel(getProp('typography.chart.fontSize'))};
        }

        .label span,
        .label tspan {
            color: ${getProp('typography.chart.color', '#333333')};
            fill: ${getProp('typography.chart.color', '#333333')};
        }

        .label.value,
        .label.value span {
            ${typography(get(themeData, 'style.chart.labels.values'))}
            ${isTrue(get(themeData, 'style.chart.labels.values.tabularNums'))
                ? `
                font-feature-settings: 'tnum';
                -webkit-font-feature-settings: 'tnum';
                -moz-font-feature-settings: 'tnum';`
                : ''}
        }

        .label span {
            text-shadow: 0 0 2px ${getProp('colors.background')};
        }

        .label.inverted span {
            text-shadow: 0 0px 2px #000000;
            color: ${getProp('style.chart.labels.inside.inverted', '#ffffff')};
        }

        .label.inside:not(.inverted) span {
            text-shadow: 0 0px 2px #ffffff;
            color: ${getProp('style.chart.labels.inside.normal', '#333333')};
        }

        .label.outline span {
            text-shadow: 0 1px 0 ${bgCol}, 1px 0 0 ${bgCol}, 0 -1px 0 ${bgCol}, -1px 0 0 ${bgCol},
                1px 1px 0 ${bgCol}, 1px -1px 0 ${bgCol}, -1px -1px 0 ${bgCol}, -1px 1px 0 ${bgCol},
                0 2px 1px ${bgCol}, 2px 0 1px ${bgCol}, 0 -2px 1px ${bgCol}, -2px 0 1px ${bgCol},
                -1px 2px 0px ${bgCol}, 2px -1px 0px ${bgCol}, -1px -2px 0px ${bgCol},
                -2px -1px 0px ${bgCol}, 1px 2px 0px ${bgCol}, 2px 1px 0px ${bgCol},
                1px -2px 0px ${bgCol}, -2px 1px 0px ${bgCol};
        }

        .label sup {
            text-shadow: none;
        }

        .label.highlighted {
            font-weight: bold;
        }

        .label.highlighted,
        .label.axis {
            font-size: ${toPixel(getProp('typography.chart.fontSize'))};
            z-index: 100;
        }

        .label.hover {
            font-weight: bold;
        }

        .label.smaller span {
            font-size: 80%;
        }

        .label.legend-text span,
        .label.legend-text {
            ${typography(get(themeData, 'style.chart.labels.legend'))}
            ${isTrue(get(themeData, 'style.chart.labels.legend.tabularNums'))
                ? `
                font-feature-settings: 'tnum';
                -webkit-font-feature-settings: 'tnum';
                -moz-font-feature-settings: 'tnum';`
                : ''}
        }

        /* filter UI tabs */
        .filter-ui.filter-links {
            border-bottom: ${getProp('style.filter.tabs.border.bottom', '1px solid #ccc')};
            font-size: ${toPixel(getProp('style.filter.tabs.fontSize'))};
        }
        .filter-ui.filter-links a {
            color: ${getProp('style.filter.tabs.color', '#666')};
        }
        .filter-ui.filter-links a:hover {
            color: ${getProp('style.filter.tabs.hover.color', '#222')};
            font-weight: ${getProp('style.filter.tabs.hover.fontWeight')};
        }
        .filter-ui.filter-links a.active {
            color: ${getProp('style.filter.tabs.active.color', '#000')};
            font-weight: ${getProp('style.filter.tabs.active.fontWeight', 'bold')};
            border-bottom: ${getProp('style.filter.tabs.active.border.bottom', '2px solid #555')};
        }
        /* filter UI select */
        .filter-ui.filter-select {
            background-color: ${getProp('colors.background', '#ffffff')};
            border-radius: ${getProp('style.filter.select.borderRadius', '4px')};
            border: ${getProp('style.filter.select.border', '1px solid #cccccc')};
            color: ${getProp('style.filter.select.textColor', getProp('typography.chart.color'))};
            font-size: ${toPixel(getProp('typography.chart.fontSize'))};
            padding: ${getProp('style.filter.select.padding', '4px 6px')};
        }
        /* filter UI timeline */
        .filter-ui .point {
            border: ${getProp('style.filter.point.buttons.border', '1px solid #ccc')};
            background: ${getProp(
                'style.filter.point.buttons.background',
                getProp('colors.background', '#fff')
            )};
        }

        .filter-ui .point:hover {
            background: ${getProp('style.filter.point.buttons.hover.background', '#ebebeb')};
        }

        .filter-ui .point.active {
            background: ${getProp('style.filter.point.buttons.active.background', '#ccc')};
            border: ${getProp('style.filter.point.buttons.active.border', '1px solid #888')};
        }

        .filter-ui .line {
            background: ${getProp('style.filter.point.line.color', '#ccc')};
        }
        .dw-tooltip {
            /* d3-maps & d3-scatter-plot tooltips */
            color: ${getProp('style.chart.tooltip.text.color', '#333333')};
        }

        text.watermark {
            opacity: ${getProp('options.watermark.opacity')};
            ${typography(omit(get(themeData, 'options.watermark.typography', {}), 'fontSize'))}
        }
    `;
}

/**
 * Styles applied to .dw-chart-header element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function chartHeaderStyles(emotion, themeData) {
    const { css, getProp } = getThemeStyleHelpers(emotion, themeData);
    return css`
        background: ${getProp('style.header.background')};
        border-bottom: ${getProp('style.header.border.bottom')};
        border-left: ${getProp('style.header.border.left')};
        border-right: ${getProp('style.header.border.right')};
        border-top: ${getProp('style.header.border.top')};
        margin: ${getProp('style.header.margin')};
        padding: ${getProp('style.header.padding')};
        text-align: ${getProp('style.header.textAlign')};

        &.has-header-right {
            gap: ${toPixel(getProp('options.header.gap', 25))};
        }
    `;
}

/**
 * Styles applied to .dw-below-header element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function belowHeaderStyles(emotion, themeData) {
    const { css } = getThemeStyleHelpers(emotion, themeData);
    return css``;
}

/**
 * Styles applied to .dw-chart-body element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function chartBodyStyles(emotion, themeData) {
    const { css, getProp } = getThemeStyleHelpers(emotion, themeData);
    return css`
        background: ${getProp('style.chart.background')};
        border-bottom: ${getProp('style.chart.border.bottom')};
        border-left: ${getProp('style.chart.border.left')};
        border-right: ${getProp('style.chart.border.right')};
        border-top: ${getProp('style.chart.border.top')};
        font-weight: ${getProp('typography.chart.fontWeight')};
        margin: ${getProp('style.chart.margin')};
        padding: ${getProp('style.chart.padding')};

        &.dark-bg .label span {
            color: ${getProp('typography.chart.color', '#f1f1f1')};
            fill: ${getProp('typography.chart.color', '#f1f1f1')};
        }

        ${get(themeData, 'style.chart.margin')
            ? ''
            : `
        &.content-below-chart {
            margin: 0px 0px 20px 0px;
        }`}
    `;
}

/**
 * Styles applied to .dw-above-footer element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function aboveFooterStyles(emotion, themeData) {
    const { css, typography, getProp } = getThemeStyleHelpers(emotion, themeData);
    return css`
        ${typography(get(themeData, 'typography.aboveFooter'))}
        background: ${getProp('style.aboveFooter.background')};
        border-bottom: ${getProp('style.aboveFooter.border.bottom')};
        border-left: ${getProp('style.aboveFooter.border.left')};
        border-right: ${getProp('style.aboveFooter.border.right')};
        border-top: ${getProp('style.aboveFooter.border.top')};
        text-align: ${getProp('style.aboveFooter.textAlign')};
        margin: ${getProp('style.aboveFooter.margin', '0px 0px 5px 0px')};
        padding: ${getProp('style.aboveFooter.padding')};
    `;
}

/**
 * Styles applied to .dw-chart-footer element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function chartFooterStyles(emotion, themeData, isStyleStatic) {
    const { css, getProp, typography } = getThemeStyleHelpers(emotion, themeData);
    return css`
        ${typography(get(themeData, 'typography.footer'))}
        background: ${getProp('style.footer.background')};
        border-bottom: ${getProp('style.footer.border.bottom')};
        border-left: ${getProp('style.footer.border.left')};
        border-right: ${getProp('style.footer.border.right')};
        border-top: ${getProp('style.footer.border.top')};
        margin: ${getProp('style.footer.margin')};
        padding: ${getProp('style.footer.padding')};
        align-items: ${getProp('options.footer.alignItems', 'center')};
        gap: ${toPixel(getProp('options.footer.gap'))};

        & > div > .footer-block a[href=''] {
            /* empty links should look like text */
            color: ${getProp('typography.footer.color')};
        }

        /** flex footer gaps **/
        & .footer-left.layout-flex-row,
        .footer-left.layout-flex-column {
            gap: ${toPixel(getProp('options.footer.left.gap', 5))};
        }
        .footer-center.layout-flex-row,
        .footer-center.layout-flex-column {
            gap: ${toPixel(getProp('options.footer.center.gap', 5))};
        }
        .footer-right.layout-flex-row,
        .footer-right.layout-flex-column {
            gap: ${toPixel(getProp('options.footer.right.gap', 5))};
        }
        /** flex-row alignments **/
        .footer-left.layout-flex-row {
            align-items: ${getProp('options.footer.left.alignItems')};
        }
        .footer-center.layout-flex-row {
            align-items: ${getProp('options.footer.center.alignItems')};
        }
        .footer-right.layout-flex-row {
            align-items: ${getProp('options.footer.right.alignItems')};
        }

        .separator:before {
            content: ${getProp('options.footer.separator.text', '"•"')};
            margin: ${getProp('options.footer.separator.margin')};
        }
        ${isStyleStatic
            ? ''
            : `
            a:not(.link-style-ignore) {
                padding: ${getProp('style.footer.links.padding')};
                border-bottom: ${getProp('style.footer.links.border.bottom')};
                font-style: ${
                    isTrue(get(themeData, 'typography.footer.cursive')) ||
                    isTrue(get(themeData, 'typography.links.cursive'))
                        ? 'italic'
                        : 'normal'
                };
            }
            `}
    `;
}

/**
 * Styles applied to .dw-below-footer element
 *
 * @param {Emotion} emotion
 * @param {*} themeData
 * @returns {string} className
 */
export function belowFooterStyles(emotion, themeData) {
    const { css, getProp, typography } = getThemeStyleHelpers(emotion, themeData);
    return css`
        ${typography(get(themeData, 'typography.belowFooter'))}
        background: ${getProp('style.belowFooter.background')};
        border-bottom: ${getProp('style.belowFooter.border.bottom')};
        border-left: ${getProp('style.belowFooter.border.left')};
        border-right: ${getProp('style.belowFooter.border.right')};
        border-top: ${getProp('style.belowFooter.border.top')};
        margin: ${getProp('style.belowFooter.margin')};
        padding: ${getProp('style.belowFooter.padding')};
        text-align: ${getProp('style.belowFooter.textAlign')};
    `;
}

/*
 * updateGlobalStyles replaces global styles and should be used
 * instead of emotion.injectGlobal whenever the inserted global styles
 * are expected to change based on render state (e.g dark mode).
 * otherwise styles from previous render remain on the DOM
 * (e.g dark background sticks when switching to/from dark mode)
 *
 * Source: https://ntsim.uk/posts/how-to-update-or-remove-global-styles-in-emotion
 */
const globalStylesCache = createCache({ key: 'global' });

export function updateGlobalStyles(cssString) {
    // remove styles
    globalStylesCache.sheet.flush();
    globalStylesCache.inserted = {};
    globalStylesCache.registered = {};

    // add styles
    const serialized = serializeStyles([cssString], cache.registered);
    if (!globalStylesCache.inserted[serialized.name]) {
        // this inserts the styles without a class name (empty string first paramater)
        globalStylesCache.insert('', serialized, globalStylesCache.sheet, true);
    }
}
