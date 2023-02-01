<script type="text/javascript">
    import WebComponentEmbed from './WebComponentEmbed.svelte';
    import { onMount, getContext } from 'svelte';

    const request = getContext('request');
    export let chartIds = [];

    let chartIdsString = chartIds.join(', ');
    let isDark;

    onMount(() => {
        const matchMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        isDark = matchMediaQuery.matches;
        matchMediaQuery.addEventListener('change', e => {
            isDark = e.matches;
        });
    });

    function loadCharts() {
        chartIds = chartIdsString.split(',').map(d => d.trim());
        // update url
        window.history.pushState(
            null,
            null,
            `${$request.path}?${new URLSearchParams({ charts: chartIds.join(',') })}`
        );
    }

    const BOOLEAN_FLAGS = ['plain', 'static', 'transparent', 'allowEditing', 'svgonly', 'map2svg'];
    const CHOICE_FLAGS = {
        dark: ['true', 'false', 'auto'],
        logo: ['on', 'off', 'auto']
    };
    const flags = Object.fromEntries(BOOLEAN_FLAGS.map(k => [k, false]));
    const choicesActive = Object.fromEntries(Object.keys(CHOICE_FLAGS).map(k => [k, false]));
    const choices = Object.fromEntries(Object.keys(CHOICE_FLAGS).map(k => [k, CHOICE_FLAGS[k][0]]));

    $: isAutoDark = choicesActive.dark && choices.dark === 'auto';
</script>

<svelte:head>
    <meta name="color-scheme" content="light dark" />
</svelte:head>

<section class="section">
    <div class="container">
        <div class="columns">
            <div class="column is-two-thirds">
                <label for="ids" class="label"
                    >Provide a list of comma-separated chart IDs to test them as web component
                    embeds:
                </label>

                <div class="field has-addons">
                    <div class="control is-expanded">
                        <input id="ids" name="charts" class="input" bind:value={chartIdsString} />
                    </div>
                    <div class="control">
                        <button class="button is-primary" on:click={loadCharts}>Go!</button>
                    </div>
                </div>
            </div>
            <div class="column">
                <strong>Render flags:</strong><br />
                {#each Object.entries(CHOICE_FLAGS) as [key, v]}
                    <label class="checkbox mr-3"
                        ><input type="checkbox" bind:checked={choicesActive[key]} />
                        {key}: {#each v as choice}
                            <label class="radio" disabled={!choicesActive[key] ? 'disabled' : null}
                                ><input
                                    type="radio"
                                    disabled={!choicesActive[key] ? 'disabled' : null}
                                    bind:group={choices[key]}
                                    value={choice}
                                />
                                {choice}</label
                            >
                        {/each}</label
                    ><br />
                {/each}
                {#each BOOLEAN_FLAGS as key}
                    <label class="checkbox mr-3"
                        ><input type="checkbox" bind:checked={flags[key]} /> {key}</label
                    >
                {/each}
            </div>
        </div>

        <hr />

        <div class="columns is-multiline">
            {#each chartIds as chartId}
                <div
                    class="column is-half"
                    class:has-background-black-ter={(choicesActive.dark &&
                        choices.dark === 'true') ||
                        (isDark && isAutoDark)}
                >
                    {#key chartId}
                        <WebComponentEmbed
                            id={chartId}
                            flags={{
                                ...flags,
                                ...Object.fromEntries(
                                    Object.keys(CHOICE_FLAGS)
                                        .filter(k => choicesActive[k])
                                        .map(k => [k, choices[k]])
                                )
                            }}
                        />
                    {/key}
                </div>
            {/each}
        </div>
    </div>
</section>
