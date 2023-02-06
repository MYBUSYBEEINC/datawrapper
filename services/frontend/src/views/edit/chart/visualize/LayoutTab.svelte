<script>
    import ChartLayout from '_partials/editor/ChartLayout.svelte';

    export let __;
    export let themes;
    export let teamSettings;
    export let layoutControlsGroups = [];
</script>

<ChartLayout {__} {themes} {teamSettings} {layoutControlsGroups} />
