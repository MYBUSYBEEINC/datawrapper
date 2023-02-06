<script>
    import IconDisplay from '_partials/displays/IconDisplay.svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let hidden = false;
    export let disabled = false;
    export let showBack = true;
    export let showProceed = true;
    export let __;

    let className = '';
    export { className as class };
</script>

{#if !hidden}
    <div class="buttons {className ?? ''}">
        {#if showBack}
            <button class="button" {disabled} on:click={() => dispatch('back')}>
                <IconDisplay icon="arrow-left" />
                <span>{__('Back')}</span>
            </button>
        {/if}
        {#if showProceed}
            <button class="button is-primary" {disabled} on:click={() => dispatch('proceed')}>
                <span>{__('Proceed')}</span>
                <IconDisplay icon="arrow-right" />
            </button>
        {/if}
    </div>
{/if}
