<script lang="ts">
    import { selectedPrompt } from "$lib/stores/prompts";
    import { showSuccess, showError } from "$lib/stores/messages";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import type { TestCase } from "$lib/types";
    import * as api from "$lib/api";

    // Test case state
    let testCases = $state<TestCase[]>([]);
    let activeTestCaseId = $state<number | null>(null);
    let editorMode = $state<"none" | "create" | "edit">("none");
    let testCaseFilter = $state("");
    let loading = $state(false);

    // Editor form state
    let formInput = $state("");
    let formExpectedOutput = $state("");
    let formExpectedOutputType = $state<"string" | "array" | "object">("array");
    let formError = $state("");
    let saving = $state(false);

    const isLlmEvaluationPrompt = $derived(() => $selectedPrompt?.evaluationMode === "llm");

    // Filtered test cases
    const filteredTestCases = $derived(() => {
        const q = testCaseFilter.trim().toLowerCase();
        if (!q) return testCases;
        return testCases.filter(
            (tc) =>
                tc.input.toLowerCase().includes(q) ||
                (!isLlmEvaluationPrompt() && tc.expectedOutput.toLowerCase().includes(q))
        );
    });

    // Load test cases when prompt changes
    $effect(() => {
        if ($selectedPrompt) {
            loadTestCases($selectedPrompt.id);
        } else {
            testCases = [];
            hideEditor();
        }
    });

    async function loadTestCases(promptId: number) {
        loading = true;
        try {
            testCases = await api.getTestCases(promptId);
        } catch (error) {
            showError("Error loading test cases");
            testCases = [];
        } finally {
            loading = false;
        }
    }

    function showEditor(mode: "create" | "edit", tc?: TestCase) {
        editorMode = mode;
        formError = "";

        if (tc) {
            formInput = tc.input;
            formExpectedOutput = tc.expectedOutput;
            formExpectedOutputType = tc.expectedOutputType;
        } else {
            formInput = "";
            formExpectedOutput = "";
            formExpectedOutputType = "array";
        }
    }

    function hideEditor() {
        editorMode = "none";
        activeTestCaseId = null;
        formError = "";
    }

    function openNewTestCase() {
        if (!$selectedPrompt) return;
        activeTestCaseId = null;
        showEditor("create");
    }

    function openExistingTestCase(tc: TestCase) {
        activeTestCaseId = tc.id;
        showEditor("edit", tc);
    }

    async function saveEditor() {
        if (!$selectedPrompt) return;

        const input = formInput.trim();
        const expectedOutput = formExpectedOutput.trim();

        if (!input) {
            formError = "Input is required.";
            return;
        }
        if (!isLlmEvaluationPrompt()) {
            if (!expectedOutput) {
                formError = "Expected output is required.";
                return;
            }
            try {
                JSON.parse(expectedOutput);
            } catch {
                formError = "Expected output must be valid JSON.";
                return;
            }
        }

        saving = true;
        formError = "";

        try {
            const data = isLlmEvaluationPrompt()
                ? { input }
                : {
                      input,
                      expected_output: expectedOutput,
                      expected_output_type: formExpectedOutputType,
                  };

            if (editorMode === "edit" && activeTestCaseId) {
                const updated = await api.updateTestCase(activeTestCaseId, data);
                showSuccess("Test case updated");
                await loadTestCases($selectedPrompt.id);
                openExistingTestCase(updated);
            } else {
                const created = await api.createTestCase($selectedPrompt.id, data);
                showSuccess("Test case created");
                await loadTestCases($selectedPrompt.id);
                openExistingTestCase(created);
            }
        } catch (error) {
            formError = (error as Error).message || "Error saving test case.";
        } finally {
            saving = false;
        }
    }

    async function deleteActiveTestCase() {
        if (!activeTestCaseId || !$selectedPrompt) return;
        if (!confirm("Delete this test case? This cannot be undone.")) return;

        try {
            await api.deleteTestCase(activeTestCaseId);
            showSuccess("Test case deleted");
            hideEditor();
            await loadTestCases($selectedPrompt.id);
        } catch (error) {
            formError = (error as Error).message || "Error deleting test case.";
        }
    }

    async function handleExport() {
        if (!$selectedPrompt) return;
        try {
            const data = await api.exportTestCases($selectedPrompt.id);
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `test-cases-${$selectedPrompt.name.replace(/[^a-z0-9]/gi, "_")}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showSuccess(`Exported ${data.length} test case${data.length !== 1 ? "s" : ""}`);
        } catch (error) {
            showError("Error exporting test cases");
        }
    }

    async function handleImport() {
        if (!$selectedPrompt) return;

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = async (e) => {
            const fileInput = e.target as HTMLInputElement;
            const file = fileInput?.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch {
                    showError("Invalid JSON file");
                    return;
                }

                if (!Array.isArray(data)) {
                    showError("JSON must be an array of test cases");
                    return;
                }

                for (let i = 0; i < data.length; i++) {
                    const tc = data[i];
                    if (!tc.input) {
                        showError(`Test case ${i + 1} is missing required field: input`);
                        return;
                    }

                    if (!isLlmEvaluationPrompt()) {
                        if (!tc.expected_output || !tc.expected_output_type) {
                            showError(`Test case ${i + 1} is missing required fields`);
                            return;
                        }
                        try {
                            JSON.parse(tc.expected_output);
                        } catch {
                            showError(`Test case ${i + 1} has invalid JSON in expected_output`);
                            return;
                        }
                    }
                }

                const count = data.length;
                const confirmMessage =
                    count === 0
                        ? "This will delete all existing test cases. Continue?"
                        : `This will replace all existing test cases with ${count} new test case${count !== 1 ? "s" : ""}. Continue?`;

                if (!confirm(confirmMessage)) return;

                const result = await api.importTestCases($selectedPrompt.id, data);
                showSuccess(`Successfully imported ${result.count} test case${result.count !== 1 ? "s" : ""}`);
                await loadTestCases($selectedPrompt.id);
            } catch (error) {
                showError("Error reading file");
            }
        };
        input.click();
    }

    function escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text ?? "";
        return div.innerHTML;
    }
</script>

<header class="content-header">
    <div class="content-header-main">
        <h1 class="content-title">Test Cases</h1>
        <p class="content-subtitle">
            {#if isLlmEvaluationPrompt()}
                Define inputs. Outputs are judged by the evaluation model.
            {:else}
                Define inputs and expected JSON outputs. Edit fast with the split view.
            {/if}
        </p>
    </div>
    <div class="content-actions">
        <button class="btn btn-secondary btn-sm" disabled={!$selectedPrompt} onclick={handleExport}>
            Export
        </button>
        <button class="btn btn-secondary btn-sm" disabled={!$selectedPrompt} onclick={handleImport}>
            Import
        </button>
        <button id="add-test-case-btn" class="btn btn-sm" disabled={!$selectedPrompt} onclick={openNewTestCase}>
            New test case
        </button>
    </div>
</header>

<div class="content-body">
    {#if !$selectedPrompt}
        <EmptyState
            icon="🗂"
            title="Select a prompt"
            description="Pick a prompt on the left to view and edit its test cases. Test cases are shared across all versions."
        />
    {:else}
        <div id="test-case-section" class="split-view">
            <section class="split-pane split-pane-list" aria-label="Test cases list">
                <div class="split-pane-header">
                    <div class="split-pane-title">
                        Test cases
                        <span class="pill">{filteredTestCases().length}</span>
                    </div>
                    <input
                        type="search"
                        placeholder="Filter test cases…"
                        autocomplete="off"
                        bind:value={testCaseFilter}
                    />
                </div>
                <div id="test-cases-list" class="tc-list">
                    {#if loading}
                        <div class="muted">Loading…</div>
                    {:else if testCases.length === 0}
                        <EmptyState
                            icon="🧪"
                            title="No test cases yet"
                            description="Create one to start testing this prompt."
                            compact
                        />
                    {:else if filteredTestCases().length === 0}
                        <EmptyState icon="🔎" title="No matches" description="Try a different filter." compact />
                    {:else}
                        {#each filteredTestCases() as tc, idx (tc.id)}
                            <button
                                class="tc-list-item"
                                class:active={tc.id === activeTestCaseId}
                                type="button"
                                onclick={() => openExistingTestCase(tc)}
                            >
                                <div class="tc-list-item-top">
                                    <div class="tc-list-item-title">#{idx + 1}</div>
                                    {#if !isLlmEvaluationPrompt()}
                                        <span class="pill pill-muted">{tc.expectedOutputType}</span>
                                    {/if}
                                </div>
                                <div class="tc-list-item-preview">
                                    {tc.input.replace(/\s+/g, " ").slice(0, 120) || "(empty input)"}
                                </div>
                            </button>
                        {/each}
                    {/if}
                </div>
            </section>

            <section class="split-pane split-pane-detail" aria-label="Test case editor">
                {#if editorMode === "none"}
                    <EmptyState
                        icon="✍️"
                        title="Pick a test case"
                        description="Select one on the left, or create a new one."
                        compact
                    />
                {:else}
                    <form id="testcase-editor" class="editor-card" onsubmit={(e) => { e.preventDefault(); saveEditor(); }}>
                        <div class="editor-header">
                            <div>
                                <div class="editor-title">
                                    {editorMode === "edit" ? "Edit test case" : "New test case"}
                                </div>
                                <div class="editor-subtitle">Prompt: {$selectedPrompt.name}</div>
                            </div>
                            <div class="editor-header-actions">
                                {#if editorMode === "edit"}
                                    <button
                                        type="button"
                                        class="btn btn-danger btn-sm"
                                        onclick={deleteActiveTestCase}
                                    >
                                        Delete
                                    </button>
                                {/if}
                            </div>
                        </div>

                        <div class="editor-body">
                            <div class="form-group">
                                <label for="tc-input">Input (user message)</label>
                                <textarea
                                    id="tc-input"
                                    placeholder="What will you send to the LLM?"
                                    bind:value={formInput}
                                ></textarea>
                            </div>
                            {#if !isLlmEvaluationPrompt()}
                                <div class="form-group">
                                    <label for="tc-expected-output">Expected output (JSON)</label>
                                    <textarea
                                        id="tc-expected-output"
                                        class="tall"
                                        placeholder={'[{"type":"company","name":"Microsoft"}]'}
                                        bind:value={formExpectedOutput}
                                    ></textarea>
                                    <small>Must be valid JSON. We compare structure + values.</small>
                                </div>
                                <div class="form-group">
                                    <label for="tc-expected-output-type">Expected output type</label>
                                    <select id="tc-expected-output-type" bind:value={formExpectedOutputType}>
                                        <option value="string">String</option>
                                        <option value="array">Array</option>
                                        <option value="object">Object</option>
                                    </select>
                                </div>
                            {/if}
                        </div>

                        <div class="editor-footer">
                            <div class="editor-footer-left">
                                {#if formError}
                                    <div class="inline-message error">{formError}</div>
                                {/if}
                            </div>
                            <div class="editor-footer-right">
                                <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    onclick={() => {
                                        if (activeTestCaseId) {
                                            const tc = testCases.find((t) => t.id === activeTestCaseId);
                                            if (tc) openExistingTestCase(tc);
                                        } else {
                                            hideEditor();
                                        }
                                    }}
                                >
                                    Cancel
                                </button>
                                <button id="testcase-save-btn" type="submit" class="btn btn-sm" disabled={saving}>
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </form>
                {/if}
            </section>
        </div>

        <div class="helper-note">Test cases are shared across all versions of this prompt.</div>
    {/if}
</div>
