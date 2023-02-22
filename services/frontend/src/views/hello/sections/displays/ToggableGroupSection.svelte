<script type="text/javascript">
    import ToggableGroup from '_partials/displays/ToggableGroup.svelte';

    export let __;
</script>

<div class="section pl-0 pt-0">
    <h3 id="preview" class="title is-3">ToggableGroup</h3>
    <p class="subtitle is-5">a trigger to toggle the visibility of some content</p>
    <ToggableGroup {__}>
        <div class="content">
            <p>
                Lorem ipsum, dolor sit amet consectetur adipisicing elit. Nobis asperiores
                reiciendis cumque perspiciatis voluptatum vel iste, aliquid provident modi est, qui
                ullam omnis deleniti alias, vero eius assumenda? Ea, beatae.
            </p>
        </div>
    </ToggableGroup>
</div>
