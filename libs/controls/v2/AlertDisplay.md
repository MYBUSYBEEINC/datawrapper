# AlertDisplay

AlertDisplay is useful for showing messages to users. There are currently 4 types: `info`, `success`, `warning` and `error`. AlertDisplay uses Bootstrap's [alert CSS](https://getbootstrap.com/2.3.2/components.html#alerts) except for 'warning' where the color is slightly changed.

Per default AlertDisplay is not visible, has a close button and has no margin (exept `margin-bottom:20px` from Bootstrap CSS).

```html
<AlertDisplay
    type="{info|success|warning|error}"
    closeable="{true|false}"
    visible="{true|false}"
    class="mt-5"
/>

<script>
    import { AlertDisplay } from '@datawrapper/controls';
    // or import directly via
    // import AlertDisplay from '@datawrapper/controls/AlertDisplay.html';

    export default {
        components: { AlertDisplay }
    };
</script>
```
