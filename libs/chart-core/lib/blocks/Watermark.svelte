<script>
    import estimateTextWidth from '@datawrapper/shared/estimateTextWidth.js';
    import { getContext } from 'svelte';

    const { outerWidth, outerHeight } = getContext('stores');

    export let props;
    const { get, purifyHtml, textDirection } = props;
    $: ({ chart, themeData } = props);

    $: field = get(themeData, 'options.watermark.custom-field');
    $: rotate = get(themeData, 'options.watermark.rotate', true);
    $: themeFontSize = get(themeData, 'options.watermark.typography.fontSize');

    $: text = get(themeData, 'options.watermark')
        ? field
            ? get(chart, `metadata.custom.${field}`, '')
            : get(themeData, 'options.watermark.text', 'CONFIDENTIAL')
        : false;

    $: width = $outerWidth;
    $: height = $outerHeight;

    $: angle = rotate ? -Math.atan(height / width) * (textDirection === 'rtl' ? -1 : 1) : 0;
    $: angleDeg = (angle * 180) / Math.PI;

    $: diagonal = rotate ? Math.sqrt(width * width + height * height) : width;

    $: estWidth = estimateTextWidth(text, 20);
    $: fontSize = themeFontSize
        ? `${themeFontSize}px`
        : `${Math.round(20 * ((diagonal * 0.75) / estWidth))}px`;
</script>

<style>
    .watermark-container {
        pointer-events: none;
    }
    .watermark {
        opacity: 0.182;
        font-weight: 700;
        text-anchor: middle;
        fill: currentColor;
        transform-box: fill-box;
        transform-origin: center;
    }
</style>

{#if height}
    <svg {width} {height} class="watermark-container">
        <text
            class="watermark"
            dominant-baseline="central"
            style="font-size: {fontSize}"
            transform="rotate({angleDeg})"
            data-rotate={angleDeg}
            x={width * 0.5}
            y={height * 0.5}>{purifyHtml(text, '')}</text
        >
    </svg>
{/if}
