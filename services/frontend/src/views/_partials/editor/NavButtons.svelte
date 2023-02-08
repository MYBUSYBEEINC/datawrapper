<script>
    import IconDisplay from '_partials/displays/IconDisplay.svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let hidden = false;
    export let disabled = false;
    export let showBack = true;
    export let showProceed = true;
    export let stepId = null;
    export let __;

    let className = '';
    export { className as class };
</script>

{#if !hidden}
    <div class="buttons {className ?? ''}">
        {#if showBack}
            <button
                class="button mb-0"
                {disabled}
                on:click={() => dispatch('back')}
                data-uid="{stepId ?? 'nav'}-back-button"
            >
                <IconDisplay icon="arrow-left" />
                <span>{__('Back')}</span>
            </button>
        {/if}
        {#if showProceed}
            <button
                class="button is-primary mb-0"
                {disabled}
                on:click={() => dispatch('proceed')}
                data-uid="{stepId ?? 'nav'}-proceed-button"
            >
                <span>{__('Proceed')}</span>
                <IconDisplay icon="arrow-right" />
            </button>
        {/if}
    </div>
{/if}
