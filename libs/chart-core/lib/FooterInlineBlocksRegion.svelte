<script>
    import Block from './Block.svelte';

    import { getContext } from 'svelte';
    const { themeData } = getContext('stores');

    export let alignment; // 'left'|'center'|'right'
    export let blocks;
    export let layout; // 'inline'|'flex-row'|'flex-column'

    export let emotion;
</script>

<style lang="scss">
    .layout-inline > .footer-block {
        display: inline;
    }
    .layout-flex-row,
    .layout-flex-column {
        display: flex;
    }
    .layout-flex-row {
        flex-direction: row;
    }
    .layout-flex-column {
        flex-direction: column;
    }

    /** flex-column alignments **/
    .footer-center.layout-flex-column {
        align-items: center;
    }
    .footer-right.layout-flex-column {
        align-items: flex-end;
    }
    /**  block alignments **/
    .footer-center.layout-inline {
        text-align: center;
    }
    .footer-right.layout-inline {
        text-align: right;
    }

    .separator {
        display: inline-block;
        font-style: initial;

        &:before {
            display: inline-block;
        }
    }

    .footer-right {
        text-align: right;
    }

    .footer-block {
        display: inline;

        a[href=''] {
            pointer-events: none;
            text-decoration: none;
            padding: 0;
            border-bottom: 0;
        }
    }
</style>

<div class="footer-{alignment} layout-{layout}">
    {#each blocks as block, i}
        {#if i && layout === 'inline'}
            <span class="separator separator-before-{block.id}" />
        {/if}
        <span
            class="footer-block {block.id}-block {emotion && block.styles
                ? block.styles(emotion, $themeData)
                : ''}"
        >
            <Block {block} />
        </span>
    {/each}
</div>
