<script>
    import { createEventDispatcher } from 'svelte';
    import IconDisplay from './IconDisplay.svelte';

    export let __ = key => key;
    export let visible = false;
    export let disabled = false;
    export let label = __('controls / more-options');
    export let icon = '';
    export let uid = 'toggable-group';

    const dispatch = createEventDispatcher();

    function toggle() {
        if (disabled) return;
        visible = !visible;
        dispatch('change', { visible });
    }
</script>

<button
    class="button mb-2"
    class:is-selected={visible}
    on:click={toggle}
    {disabled}
    data-uid="{uid}-trigger"
>
    {#if icon}
        <span class="icon">
            <IconDisplay {icon} size="20px" />
        </span>
    {/if}
    <span>{label}</span>
</button>

{#if visible}
    <slot>
        <!-- Default slot will render an empty div when visible, useful for testing. -->
        <div data-uid="{uid}-content" />
    </slot>
{/if}
