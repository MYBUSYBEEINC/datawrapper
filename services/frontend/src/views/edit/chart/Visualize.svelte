<script>
    // displays
    import ChartEditorPreview from '_partials/editor/ChartEditorPreview.svelte';
    import IconDisplay from '_partials/displays/IconDisplay.svelte';
    import MessageDisplay from '_partials/displays/MessageDisplay.svelte';
    // editor
    import ColorblindCheck from '_partials/editor/ColorblindCheck.svelte';
    import DarkModeToggle from '_partials/editor/DarkModeToggle.svelte';
    import PreviewResizer from '_partials/editor/PreviewResizer.svelte';
    import Toolbar from '_partials/editor/Toolbar.svelte';
    import ToolbarArea from '_partials/editor/ToolbarArea.svelte';
    // other Svelte
    import ViewComponent from '_partials/ViewComponent.svelte';

    // other JS
    import { getContext } from 'svelte';
    import { fade } from 'svelte/transition';
    import { headerProps } from '_layout/stores';

    // load stores from context
    const { chart, customViews, isFixedHeight, selectTab } = getContext('page/edit');

    export let __;
    export let dwChart;

    let iframePreview;

    let scrollY = 0;
    let innerHeight = 0;
    let innerWidth = 0;

    $: isSticky = innerHeight > 600 && innerWidth > 1200;

    // controlled by ChartPreviewIframe
    let previewWidth;

    function onPreviewResize(event) {
        dwChart.set('metadata.publish.embed-width', event.detail.width);
        const reset = { width: null };
        if (event.detail.height) {
            reset.height = null;
            dwChart.set(
                'metadata.publish.embed-height',
                event.detail.height - 10 // subtract 10px since the preview is editable
            );
        }
        iframePreview.set(reset);
    }

    let messages = [];
    function onPreviewMessage(event) {
        const { type, data } = event.detail;
        if (type === 'editor:notification:show') {
            messages = [...messages, data];
        }
        if (type === 'editor:notification:hide') {
            messages = messages.filter(({ id }) => id !== data.id);
        }
    }

    let sidebarWidth;
    let mainWidth;

    $: sidebarMarginLeft =
        -0.5 *
        Math.min(
            innerWidth - mainWidth - 20,
            Math.max(0, previewWidth - (mainWidth - sidebarWidth))
        );

    function measureBodyHeight() {
        iframePreview.getContext((contentWindow, contentDocument) => {
            const chartBody = contentDocument.querySelector('.dw-chart-body');
            if (chartBody && chartBody.getBoundingClientRect) {
                const chartBodyHeight = Math.ceil(chartBody.getBoundingClientRect().height);
                if ($chart.metadata.publish['chart-height'] !== chartBodyHeight) {
                    $chart.metadata.publish['chart-height'] = chartBodyHeight;
                }
            }
        });
    }
</script>

<style lang="scss">
    @import '../../../styles/export.scss';
    .preview.sticky {
        position: sticky;
        top: 20px;
    }
    .preview.sticky.sticky-header {
        top: 85px;
    }

    .limit-width {
        overflow-x: auto;
        overflow-y: clip;
        height: auto;
    }

    .sidebar {
        position: relative;
    }
</style>

<svelte:window bind:innerHeight bind:innerWidth bind:scrollY />

<div class="columns" bind:clientWidth={mainWidth}>
    <div class="column is-one-third">
        <div class="sidebar" style="left:{sidebarMarginLeft}px" bind:clientWidth={sidebarWidth}>
            <slot />
        </div>
    </div>
    <div class="column">
        <div class="preview" class:sticky={isSticky} class:sticky-header={$headerProps.isSticky}>
            <div style="position:relative;left:{sidebarMarginLeft}px">
                <div class="block limit-width" style="max-width:{innerWidth - sidebarWidth - 75}px">
                    <ChartEditorPreview
                        bind:this={iframePreview}
                        bind:previewWidth
                        allowInlineEditing
                        allowResizing
                        ignoreVisualizeMetadataProps={['text-annotations', 'range-annotations']}
                        fixedHeight={$isFixedHeight}
                        previewId="visualize"
                        on:resize={onPreviewResize}
                        on:message={onPreviewMessage}
                        on:render={measureBodyHeight}
                    />
                </div>

                {#each messages as message}
                    <div
                        class="block is-flex is-justify-content-center"
                        transition:fade={{ duration: 300 }}
                    >
                        <MessageDisplay
                            deletable={message.deletable}
                            title={message.title}
                            type={message.type || 'info'}
                            visible
                        >
                            {#if message.pending}
                                <IconDisplay
                                    icon="loading-spinner"
                                    size="20px"
                                    className="mr-1"
                                    valign="middle"
                                    timing="steps(12)"
                                    duration="1s"
                                    spin
                                />
                            {/if}
                            {__(message.translateKey)}
                        </MessageDisplay>
                    </div>
                {/each}

                <div class="block mt-5 pt-2">
                    <Toolbar>
                        {#if customViews && customViews.visualizeToolbarPrepend && customViews.visualizeToolbarPrepend.length > 0}
                            {#each customViews.visualizeToolbarPrepend as comp}
                                <ViewComponent id={comp.id} {__} props={{ ...comp.props }} />
                            {/each}
                        {/if}

                        <ToolbarArea title={__('edit / preview')}>
                            <PreviewResizer {__} {iframePreview} />
                            <ColorblindCheck iframe={iframePreview} {__} />
                            <DarkModeToggle
                                {__}
                                on:change-tab={evt => selectTab({ id: evt.detail })}
                            />
                        </ToolbarArea>
                    </Toolbar>
                </div>
            </div>
        </div>
    </div>
</div>
