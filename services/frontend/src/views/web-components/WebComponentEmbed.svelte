<script>
    import { onMount } from 'svelte';

    export let id = null;
    export let flags = {};

    let div = null;
    onMount(embed);

    function embed() {
        if (id === '' || typeof document === 'undefined' || !div) return;
        div.innerHTML = '';
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `/preview/${id}/embed.js`;
        for (const [key, value] of Object.entries(flags)) {
            script.setAttribute(`data-${key}`, value);
        }
        div.appendChild(script);
    }

    $: {
        if (flags) embed();
    }
</script>

<div bind:this={div} />
