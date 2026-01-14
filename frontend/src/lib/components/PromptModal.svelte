<script lang="ts">
    import Modal from "./Modal.svelte";
    import { createPrompt, createPromptVersion } from "$lib/stores/prompts";
    import { showError } from "$lib/stores/messages";
    import * as api from "$lib/api";
    import type { Prompt } from "$lib/types";

    interface Props {
        mode: "new" | "edit" | "view";
        open: boolean;
        onclose: () => void;
        promptId?: number;
        promptName?: string;
        promptVersion?: number;
    }

    let { mode, open, onclose, promptId, promptName, promptVersion }: Props = $props();

    let name = $state("");
    let content = $state("");
    let expectedSchema = $state("");
    let loading = $state(false);
    let loadedPrompt = $state<Prompt | null>(null);

    // Load prompt data when opening edit/view modal
    $effect(() => {
        if (open && promptId && (mode === "edit" || mode === "view")) {
            loadPromptData(promptId);
        } else if (!open) {
            // Reset form when closing
            name = "";
            content = "";
            expectedSchema = "";
            loadedPrompt = null;
        }
    });

    async function loadPromptData(id: number) {
        loading = true;
        try {
            const prompt = await api.getPrompt(id);
            loadedPrompt = prompt;
            name = prompt.name;
            content = prompt.content;
            expectedSchema = prompt.expectedSchema || "";
        } catch (error) {
            showError("Error loading prompt");
        } finally {
            loading = false;
        }
    }

    function validateSchema(schema: string): boolean {
        if (!schema.trim()) return true;
        try {
            JSON.parse(schema);
            return true;
        } catch {
            return false;
        }
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();

        if (!name.trim() || !content.trim()) {
            showError("Please fill in all required fields");
            return;
        }

        if (expectedSchema && !validateSchema(expectedSchema)) {
            showError("Expected output schema must be valid JSON");
            return;
        }

        loading = true;
        try {
            if (mode === "new") {
                const result = await createPrompt({
                    name: name.trim(),
                    content: content.trim(),
                    expectedSchema: expectedSchema.trim() || undefined,
                });
                if (result) {
                    onclose();
                }
            } else if (mode === "edit" && promptId && promptName) {
                const result = await createPromptVersion(
                    promptId,
                    promptName,
                    content.trim(),
                    expectedSchema.trim() || undefined
                );
                if (result) {
                    onclose();
                }
            }
        } finally {
            loading = false;
        }
    }

    function formatJSON(json: string): string {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch {
            return json;
        }
    }

    const title = $derived(
        mode === "new"
            ? "Create New Prompt"
            : mode === "edit"
            ? `Edit "${promptName}"`
            : promptName || "Prompt"
    );
</script>

<Modal id="new-prompt-modal" {open} {title} wide={mode === "view"} onclose={onclose}>
    {#snippet titleBadge()}
        {#if mode !== "new" && (promptVersion || loadedPrompt?.version)}
            <span class="badge badge-version">v{promptVersion || loadedPrompt?.version}</span>
        {/if}
    {/snippet}

    {#if mode === "view"}
        <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label>Prompt Content</label>
            <pre class="view-prompt-content">{loadedPrompt?.content || ""}</pre>
        </div>
        {#if loadedPrompt?.expectedSchema}
            <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>Expected Output Schema</label>
                <pre class="view-prompt-content">{formatJSON(loadedPrompt.expectedSchema)}</pre>
            </div>
        {/if}
    {:else}
        <form id="new-prompt-form" onsubmit={handleSubmit}>
            {#if mode === "new"}
                <div class="form-group">
                    <label for="new-prompt-name">Prompt Name</label>
                    <input
                        type="text"
                        id="new-prompt-name"
                        bind:value={name}
                        placeholder="e.g., extract-entities"
                        required
                    />
                </div>
            {/if}
            <div class="form-group">
                <label for="new-prompt-content">Prompt Content</label>
                <textarea
                    id="new-prompt-content"
                    class="tall"
                    bind:value={content}
                    placeholder="Enter your system prompt here..."
                    required
                ></textarea>
                {#if mode === "edit"}
                    <small>Saving will create a new version of this prompt</small>
                {/if}
            </div>
            <div class="form-group">
                <label for="prompt-schema">Expected Output Schema (JSON)</label>
                <textarea
                    id="prompt-schema"
                    class="medium"
                    bind:value={expectedSchema}
                    placeholder={'{"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}}}}'}
                ></textarea>
                <small>Optional. JSON Schema for structured LLM output (used with response_format).</small>
            </div>
        </form>
    {/if}

    {#snippet footer()}
        {#if mode === "view"}
            <button type="button" class="secondary" onclick={onclose}>Close</button>
        {:else}
            <button type="button" class="secondary" onclick={onclose}>Cancel</button>
            <button type="submit" form="new-prompt-form" disabled={loading}>
                {#if loading}
                    Saving...
                {:else if mode === "new"}
                    Create Prompt
                {:else}
                    Save as New Version
                {/if}
            </button>
        {/if}
    {/snippet}
</Modal>
