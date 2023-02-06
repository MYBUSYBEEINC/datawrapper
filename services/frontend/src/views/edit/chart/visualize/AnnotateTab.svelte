<script>
    import ChartControls from './ChartControls.svelte';
    import ChartDescription from '_partials/editor/ChartDescription.svelte';
    import { getContext } from 'svelte';
    // load stores from context
    const { chart } = getContext('page/edit');

    export let __;
    export let dwChart;
    export let teamSettings;
</script>

<div class="block">
    <ChartDescription {chart} {teamSettings} {__} />
</div>
<ChartControls controlsModule="Annotate" {dwChart} {teamSettings} {__} />
