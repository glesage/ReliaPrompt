<script lang="ts">
    import { onMount } from "svelte";
    import PromptsPane from "./PromptsPane.svelte";
    import ConfigModal from "./ConfigModal.svelte";
    import MessageToast from "./MessageToast.svelte";
    import { initModels } from "$lib/stores/models";
    import { loadConfig } from "$lib/stores/config";
    import { initUiMode, selectLibrarySuite, librarySuites } from "$lib/stores/uiMode";
    import { get } from "svelte/store";

    let { children } = $props();

    onMount(async () => {
        await initUiMode();
        await Promise.all([initModels(), loadConfig()]);
        const suites = get(librarySuites);
        if (suites.length > 0) selectLibrarySuite(suites[0].id);
    });
</script>

<div class="app-layout app-shell">
    <PromptsPane />
    <main class="app-pane app-pane-content" aria-label="Content">
        <MessageToast />
        {@render children()}
    </main>
</div>

<ConfigModal />
