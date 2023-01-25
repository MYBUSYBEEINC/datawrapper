<script>
    import Block from './Block.svelte';
    import { themeData } from './stores';

    export let id;
    export let name;
    export let blocks = [];
    export let styles = null;
    export let emotion;

    function blockEl(tag) {
        return tag === 'h3' || tag === 'p' ? tag : 'div';
    }

    if (!emotion) throw new Error('need to pass emotion for block region ' + name);
</script>

{#if blocks.length}
    <div {id} class="{name} {emotion && styles ? styles(emotion, $themeData) : ''}">
        {#each blocks as block}
            <svelte:element
                this={blockEl(block.tag)}
                class="block {block.id}-block {emotion && block.styles
                    ? block.styles(emotion, $themeData)
                    : ''}"
                style={blockEl(block.tag) === 'div' && block.id.includes('svg-rule')
                    ? 'font-size:0px;'
                    : ''}
            >
                <Block {block} />
            </svelte:element>
        {/each}
    </div>
{/if}
