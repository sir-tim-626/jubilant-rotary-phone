<script>
    import { fly } from "svelte/transition";

    export let duration = 1000;
    export let distance = 200;
</script>

<div in:fly={{ duration, y: distance }} out:fly={{ duration, y: distance }}>
    <slot />
</div>
