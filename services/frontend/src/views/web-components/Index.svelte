<script type="text/javascript">
    import WebComponentEmbed from './WebComponentEmbed.svelte';
    import { onMount } from 'svelte';
    export let chartIds = [];
    let groupedCharts = [];
    $: {
        groupedCharts = chartIds.reduce(
            (acc, cur) => {
                const group = acc[acc.length - 1];
                group.push(cur);
                if (group.length === 2) acc.push([]);
                return acc;
            },
            [[]]
        );
    }

    let isDark;

    onMount(() => {
        const matchMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        isDark = matchMediaQuery.matches;
        matchMediaQuery.addEventListener('change', e => {
            isDark = e.matches;
        });
    });

    const BOOLEAN_FLAGS = ['plain', 'static', 'transparent', 'allowEditing', 'svgonly', 'map2svg'];
    const CHOICE_FLAGS = {
        dark: ['true', 'false', 'auto']
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
            <div class="column">
                <p>
                    Provide a list of comma-separated chart IDs to test them as web component
                    embeds:
                </p>
                <form action="/v2/web-components" method="GET">
                    <input name="charts" class="input" value={chartIds} />
                    <input type="submit" value="Go" />
                </form>
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
                    >
                {/each}
                {#each BOOLEAN_FLAGS as key}
                    <label class="checkbox mr-3"
                        ><input type="checkbox" bind:checked={flags[key]} /> {key}</label
                    >
                {/each}
            </div>
        </div>

        <hr />

        {#each groupedCharts as charts}
            <div
                class="columns preview"
                class:has-background-black-ter={(choicesActive.dark && choices.dark === 'true') ||
                    (isDark && isAutoDark)}
            >
                {#each charts as chart}
                    <div class="column">
                        <WebComponentEmbed
                            id={chart}
                            flags={{
                                ...flags,
                                ...Object.fromEntries(
                                    Object.keys(CHOICE_FLAGS)
                                        .filter(k => choicesActive[k])
                                        .map(k => [k, choices[k]])
                                )
                            }}
                        />
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</section>
