<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        goto("/test-cases");
    });
</script>

<p>Redirecting to Test Cases...</p>
