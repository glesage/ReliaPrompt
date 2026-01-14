<script lang="ts">
    import "../app.css";
    import AppLayout from "$lib/components/AppLayout.svelte";

    let { children } = $props();
</script>

<AppLayout>
    {@render children()}
</AppLayout>
