<script>
    import HorizontalFormFieldDisplay from '_partials/displays/HorizontalFormFieldDisplay.svelte';
    import get from '@datawrapper/shared/get.js';
    import SelectInput from '_partials/controls/SelectInput.svelte';
    import SwitchControl from '_partials/controls/SwitchControl.svelte';
    import { getContext, tick } from 'svelte';

    const { chart, theme } = getContext('page/edit');

    export let __;
    export let requireUpgrade;

    $: logos = get($theme.data, 'options.blocks.logo.data.options', []);
    $: themeHasLogo = !!logos.find(logo => logo.text || logo.imgSrc);

    $: tooltip = requireUpgrade ? __('layout / logo / upgrade-info') : false;

    $: logoOptions = logos.map(({ id, title }) => ({ value: id, label: title }));

    const updateLogoId = async id => {
        // Make sure we don't interfere with any Svelte2Wrapper state updates from the chart controls.
        await tick();
        $logoId = id;
    };

    $: {
        if (logos?.length && logos[0].id !== $logoId && !logos.some(d => d.id === $logoId)) {
            updateLogoId(logos[0].id);
        }
    }

    const logoId = chart.bindKey('metadata.publish.blocks.logo.id');
    const logoEnabled = chart.bindKey('metadata.publish.blocks.logo.enabled');
</script>

{#if logos.length > 1}
    <HorizontalFormFieldDisplay compact label={__('layout / logo')}>
        <SelectInput bind:value={$logoId} options={logoOptions} />
    </HorizontalFormFieldDisplay>
{/if}
{#if requireUpgrade || themeHasLogo}
    <SwitchControl
        bind:value={$logoEnabled}
        disabled={requireUpgrade}
        label={__('layout / logo / show')}
        {tooltip}
        tooltipType="upgrade"
    />
{/if}
