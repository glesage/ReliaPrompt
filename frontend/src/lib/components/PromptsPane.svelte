<script lang="ts">
    import {
        filteredPromptGroups,
        promptFilter,
        promptsLoading,
        deselectPrompt,
    } from "$lib/stores/prompts";
    import PromptGroup from "./PromptGroup.svelte";
    import * as api from "$lib/api";
    import { showSuccess, showError } from "$lib/stores/messages";
    import { loadPrompts } from "$lib/stores/prompts";

    interface Props {
        onNewPrompt: () => void;
        onViewPrompt: (id: number, name: string, version?: number) => void;
        onEditPrompt: (id: number, name: string) => void;
    }

    let { onNewPrompt, onViewPrompt, onEditPrompt }: Props = $props();

    function handleFilterInput(e: Event) {
        const target = e.target as HTMLInputElement;
        promptFilter.set(target.value);
    }

    function handleListClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.classList.contains("sidebar-list") || target.classList.contains("sidebar-empty")) {
            deselectPrompt();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
            e.preventDefault();
            const input = document.getElementById("prompt-filter") as HTMLInputElement;
            input?.focus();
        }
    }

    async function handleExport() {
        try {
            const data = await api.exportPrompts();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `prompts-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccess(`Exported ${data.length} prompt${data.length !== 1 ? "s" : ""}`);
        } catch (error) {
            showError("Error exporting prompts");
        }
    }

    async function handleImport() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = async (e) => {
            const fileInput = e.target as HTMLInputElement;
            const file = fileInput?.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                let promptsData;
                try {
                    promptsData = JSON.parse(text);
                } catch {
                    showError("Invalid JSON file");
                    return;
                }

                if (!Array.isArray(promptsData)) {
                    showError("JSON must be an array of prompts");
                    return;
                }

                for (let i = 0; i < promptsData.length; i++) {
                    const p = promptsData[i];
                    if (!p.name || !p.content) {
                        showError(`Prompt ${i + 1} is missing required fields (name, content)`);
                        return;
                    }
                }

                const count = promptsData.length;
                if (
                    !confirm(
                        `Import ${count} prompt${count !== 1 ? "s" : ""}? Prompts with existing names will be skipped.`
                    )
                ) {
                    return;
                }

                const result = await api.importPrompts(promptsData);
                let message = `Imported ${result.created} prompt${result.created !== 1 ? "s" : ""}`;
                if (result.skipped > 0) {
                    message += `, skipped ${result.skipped} (already exist)`;
                }
                showSuccess(message);
                await loadPrompts();
            } catch (error) {
                showError("Error reading file");
            }
        };
        input.click();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<aside class="app-pane app-pane-prompts" aria-label="Prompts">
    <div class="pane-header">
        <div class="pane-title">Prompts</div>
        <div class="pane-header-actions">
            <button class="btn btn-secondary btn-sm" onclick={handleExport} title="Export all prompts">
                Export
            </button>
            <button class="btn btn-secondary btn-sm" onclick={handleImport} title="Import prompts">
                Import
            </button>
            <button id="new-prompt-btn" class="btn btn-primary btn-sm" onclick={onNewPrompt}>New</button>
        </div>
    </div>
    <div class="pane-search">
        <input
            id="prompt-filter"
            type="search"
            placeholder="Search prompts…"
            autocomplete="off"
            value={$promptFilter}
            oninput={handleFilterInput}
        />
        <div class="pane-search-hint">⌘K</div>
    </div>
    <div class="pane-body">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sidebar-list" id="sidebar-prompts" onclick={handleListClick}>
            {#if $promptsLoading}
                <div class="sidebar-empty">Loading...</div>
            {:else if $filteredPromptGroups.length === 0}
                {#if $promptFilter}
                    <div class="sidebar-empty">No matches.<br />Try a different search.</div>
                {:else}
                    <div class="sidebar-empty">No prompts yet.<br />Create your first one!</div>
                {/if}
            {:else}
                {#each $filteredPromptGroups as group (group.promptGroupId)}
                    <PromptGroup {group} {onViewPrompt} {onEditPrompt} />
                {/each}
            {/if}
        </div>
    </div>
</aside>
