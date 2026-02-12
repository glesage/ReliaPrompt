<script lang="ts">
    import { librarySuites, selectedLibrarySuiteId, selectLibrarySuite } from "$lib/stores/uiMode";
    import { openConfigModal } from "$lib/stores/config";
    import Modal from "./Modal.svelte";
    import type { PromptSuiteDefinition } from "$backend/definitions/types";

    let viewPromptModalOpen = $state(false);
    let viewedSuite = $state<PromptSuiteDefinition | null>(null);

    function openPromptView(suite: PromptSuiteDefinition, e: MouseEvent) {
        e.stopPropagation();
        viewedSuite = suite;
        viewPromptModalOpen = true;
    }

    function closePromptView() {
        viewPromptModalOpen = false;
        viewedSuite = null;
    }
</script>

<aside class="app-pane app-pane-prompts" aria-label="Prompts">
    <div class="pane-header">
        <div class="pane-title">Prompts</div>
        <button
            id="setup-btn"
            type="button"
            class="pane-llm-btn"
            onclick={openConfigModal}
            title="View configured LLMs"
        >
            LLMs
        </button>
    </div>
    <div class="pane-body">
        <div class="prompts-table-wrap" id="sidebar-prompts">
            {#if $librarySuites.length === 0}
                <div class="sidebar-empty">
                    No suites found.<br />Add reliaprompt.definitions.ts.
                </div>
            {:else}
                <table class="prompts-table">
                    <tbody>
                        {#each $librarySuites as suite (suite.id)}
                            <tr
                                class="prompts-table-row"
                                class:active={$selectedLibrarySuiteId === suite.id}
                                onclick={() => selectLibrarySuite(suite.id)}
                            >
                                <td class="prompts-table-cell prompts-table-cell-name">
                                    <span class="prompts-table-name">{suite.prompt.name}</span>
                                </td>
                                <td class="prompts-table-cell prompts-table-cell-actions">
                                    <button
                                        type="button"
                                        class="prompt-view-btn"
                                        title="View prompt"
                                        aria-label={`View ${suite.prompt.name}`}
                                        onclick={(e) => openPromptView(suite, e)}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path
                                                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                                            />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </div>
</aside>

<Modal
    id="prompt-view-modal"
    open={viewPromptModalOpen}
    title={viewedSuite ? `View prompt: ${viewedSuite.prompt.name}` : "View prompt"}
    wide
    onclose={closePromptView}
>
    {#if viewedSuite}
        <div class="prompt-view-content">
            <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>Prompt content</label>
                <pre class="view-prompt-content">{viewedSuite.prompt.content}</pre>
            </div>
            {#if viewedSuite.prompt.evaluationMode}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Evaluation mode</label>
                    <div class="view-prompt-content">{viewedSuite.prompt.evaluationMode}</div>
                </div>
            {/if}
            {#if viewedSuite.prompt.evaluationCriteria}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Evaluation criteria</label>
                    <pre class="view-prompt-content">{viewedSuite.prompt.evaluationCriteria}</pre>
                </div>
            {/if}
            {#if viewedSuite.prompt.expectedSchema}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Expected schema</label>
                    <pre class="view-prompt-content">{viewedSuite.prompt.expectedSchema}</pre>
                </div>
            {/if}
        </div>
    {/if}
</Modal>

<style>
    .prompts-table-wrap {
        width: 100%;
        min-width: 0;
    }

    .prompts-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    .prompts-table-row {
        cursor: pointer;
        transition: background 0.12s ease;
    }

    .prompts-table-row:hover {
        background: var(--color-sidebar-hover);
    }

    .prompts-table-row.active {
        background: rgba(16, 185, 129, 0.14);
        border-left: 2px solid var(--color-accent);
    }

    .prompts-table-cell {
        padding: 10px 12px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .prompts-table-cell-name {
        width: 100%;
        min-width: 0;
    }

    .prompts-table-name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-base);
        color: rgba(255, 255, 255, 0.9);
    }

    .prompts-table-cell-actions {
        width: 40px;
        text-align: right;
        padding-left: 0;
    }

    .prompt-view-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .prompt-view-btn:hover {
        background: rgba(59, 130, 246, 0.18);
        border-color: rgba(96, 165, 250, 0.55);
        color: #dbeafe;
    }

    .prompt-view-btn svg {
        width: 15px;
        height: 15px;
    }
</style>
