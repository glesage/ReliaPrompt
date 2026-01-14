<script lang="ts">
    import { onMount } from "svelte";
    import Rail from "./Rail.svelte";
    import PromptsPane from "./PromptsPane.svelte";
    import ConfigModal from "./ConfigModal.svelte";
    import PromptModal from "./PromptModal.svelte";
    import MessageToast from "./MessageToast.svelte";
    import { loadPrompts, restoreSelection } from "$lib/stores/prompts";
    import { initModels } from "$lib/stores/models";
    import { loadConfig } from "$lib/stores/config";

    let { children } = $props();

    // Prompt modal state
    let promptModalOpen = $state(false);
    let promptModalMode = $state<"new" | "edit" | "view">("new");
    let promptModalId = $state<number | undefined>(undefined);
    let promptModalName = $state<string | undefined>(undefined);
    let promptModalVersion = $state<number | undefined>(undefined);

    function openNewPromptModal() {
        promptModalMode = "new";
        promptModalId = undefined;
        promptModalName = undefined;
        promptModalVersion = undefined;
        promptModalOpen = true;
    }

    function openViewPromptModal(id: number, name: string, version?: number) {
        promptModalMode = "view";
        promptModalId = id;
        promptModalName = name;
        promptModalVersion = version;
        promptModalOpen = true;
    }

    function openEditPromptModal(id: number, name: string) {
        promptModalMode = "edit";
        promptModalId = id;
        promptModalName = name;
        promptModalVersion = undefined;
        promptModalOpen = true;
    }

    function closePromptModal() {
        promptModalOpen = false;
    }

    onMount(async () => {
        // Initialize all data
        await Promise.all([loadPrompts(), initModels(), loadConfig()]);
        await restoreSelection();
    });
</script>

<div class="app-layout app-shell">
    <Rail />
    <PromptsPane
        onNewPrompt={openNewPromptModal}
        onViewPrompt={openViewPromptModal}
        onEditPrompt={openEditPromptModal}
    />
    <main class="app-pane app-pane-content" aria-label="Content">
        <MessageToast />
        {@render children()}
    </main>
</div>

<ConfigModal />
<PromptModal
    mode={promptModalMode}
    open={promptModalOpen}
    onclose={closePromptModal}
    promptId={promptModalId}
    promptName={promptModalName}
    promptVersion={promptModalVersion}
/>
