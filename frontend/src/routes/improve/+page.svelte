<script lang="ts">
    import { selectedPrompt } from "$lib/stores/prompts";
    import { selectedModels, modelsByProvider, initModels, availableModels } from "$lib/stores/models";
    import { showSuccess, showError, showInfo } from "$lib/stores/messages";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ScoreBadge from "$lib/components/ScoreBadge.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import type { TestCase, ImprovementJob, SelectedModel, ImprovementTemplate } from "$lib/types";
    import * as api from "$lib/api";
    import { createPromptVersion } from "$lib/stores/prompts";
    import { onMount } from "svelte";

    // State
    let testCaseCount = $state(0);
    let maxIterations = $state(3);
    let runsPerLlm = $state(1);
    let improvementModel = $state<SelectedModel[]>([]);
    let benchmarkModels = $state<SelectedModel[]>([]);

    let running = $state(false);
    let progress = $state(0);
    let currentIteration = $state(0);
    let log = $state<string[]>([]);

    let originalScore = $state<number | null>(null);
    let bestScore = $state<number | null>(null);
    let bestPromptContent = $state<string | null>(null);

    let previousJobs = $state<ImprovementJob[]>([]);
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Template modal
    let templateModalOpen = $state(false);
    let templateText = $state("");
    let defaultTemplate = $state("");
    let loadingTemplate = $state(false);
    let savingTemplate = $state(false);

    // Load test cases when prompt changes
    $effect(() => {
        if ($selectedPrompt) {
            loadTestCaseCount($selectedPrompt.id);
            loadPreviousJobs($selectedPrompt.id);
        } else {
            testCaseCount = 0;
            previousJobs = [];
            resetState();
        }
    });

    // Sync benchmark models with selected models from config
    $effect(() => {
        benchmarkModels = $selectedModels;
    });

    async function loadTestCaseCount(promptId: number) {
        try {
            const testCases = await api.getTestCases(promptId);
            testCaseCount = testCases.length;
        } catch {
            testCaseCount = 0;
        }
    }

    async function loadPreviousJobs(promptId: number) {
        try {
            previousJobs = await api.getImprovementJobs(promptId);
        } catch {
            previousJobs = [];
        }
    }

    function resetState() {
        running = false;
        progress = 0;
        currentIteration = 0;
        log = [];
        originalScore = null;
        bestScore = null;
        bestPromptContent = null;
    }

    async function startImprovement() {
        if (!$selectedPrompt) return;
        if (improvementModel.length === 0) {
            showError("Please select an improvement model");
            return;
        }
        if (benchmarkModels.length === 0) {
            showError("Please select at least one benchmark model");
            return;
        }

        running = true;
        progress = 0;
        currentIteration = 0;
        log = ["Starting improvement process..."];
        originalScore = null;
        bestScore = null;
        bestPromptContent = null;

        try {
            const { jobId } = await api.startImprovement({
                promptId: $selectedPrompt.id,
                maxIterations,
                runsPerLlm,
                improvementModel: improvementModel[0],
                benchmarkModels,
            });
            pollProgress(jobId);
        } catch (error) {
            showError((error as Error).message || "Failed to start improvement");
            running = false;
        }
    }

    function pollProgress(jobId: string) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const status = await api.getImprovementStatus(jobId);

                progress = (status.currentIteration / status.maxIterations) * 100;
                currentIteration = status.currentIteration;
                log = status.log || [];

                if (status.originalScore !== undefined) originalScore = status.originalScore;
                if (status.bestScore !== undefined) bestScore = status.bestScore;
                if (status.bestPromptContent) bestPromptContent = status.bestPromptContent;

                if (status.status === "completed") {
                    clearInterval(pollInterval!);
                    running = false;
                    showSuccess("Improvement process completed!");
                    if ($selectedPrompt) loadPreviousJobs($selectedPrompt.id);
                } else if (status.status === "failed") {
                    clearInterval(pollInterval!);
                    running = false;
                    showError(status.error || "Improvement process failed");
                    if ($selectedPrompt) loadPreviousJobs($selectedPrompt.id);
                }
            } catch {
                // Silently continue polling
            }
        }, 1000);
    }

    async function viewPreviousJob(job: ImprovementJob) {
        progress = (job.currentIteration / job.maxIterations) * 100;
        currentIteration = job.currentIteration;
        log = job.log || [];
        originalScore = job.originalScore ?? null;
        bestScore = job.bestScore ?? null;
        bestPromptContent = job.bestPromptContent ?? null;
        showInfo(`Loaded job from ${formatDate(job.createdAt)}`);
    }

    async function saveAsNewVersion() {
        if (!$selectedPrompt || !bestPromptContent) return;

        const result = await createPromptVersion(
            $selectedPrompt.id,
            $selectedPrompt.name,
            bestPromptContent,
            $selectedPrompt.expectedSchema
        );

        if (result) {
            showSuccess("Improved prompt saved as new version!");
        }
    }

    // Template modal handlers
    async function openTemplateModal() {
        templateModalOpen = true;
        loadingTemplate = true;
        try {
            const data = await api.getImprovementTemplate();
            templateText = data.template;
            defaultTemplate = data.defaultTemplate;
        } catch (error) {
            showError("Error loading template");
        } finally {
            loadingTemplate = false;
        }
    }

    async function saveTemplate() {
        savingTemplate = true;
        try {
            await api.saveImprovementTemplate(templateText);
            showSuccess("Template saved!");
            templateModalOpen = false;
        } catch (error) {
            showError("Error saving template");
        } finally {
            savingTemplate = false;
        }
    }

    function resetTemplate() {
        templateText = defaultTemplate;
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }

    function scoreToPercent(score: number): number {
        if (score > 1) return score;
        return Math.round(score * 100);
    }

    const canStart = $derived(
        testCaseCount > 0 && improvementModel.length > 0 && benchmarkModels.length > 0 && !running
    );

    const scoreDelta = $derived(() => {
        if (originalScore === null || bestScore === null) return null;
        return scoreToPercent(bestScore) - scoreToPercent(originalScore);
    });

    onMount(() => {
        initModels();
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    });
</script>

<header class="content-header">
    <div class="content-header-main">
        <h1 class="content-title">Auto-Improve</h1>
        <p class="content-subtitle">
            Let an LLM iteratively improve your prompt by testing and refining based on test case results.
        </p>
    </div>
    <div class="content-actions">
        <button type="button" class="btn btn-secondary btn-sm" onclick={openTemplateModal}>
            Edit Template
        </button>
    </div>
</header>

<div class="content-body">
    {#if !$selectedPrompt}
        <EmptyState
            icon="🧠"
            title="Select a prompt"
            description="Pick a prompt to auto-improve using LLM-based iterative refinement."
        />
    {:else}
        <div id="improve-section" class="content-grid">
            <section class="content-col">
                <div class="card">
                    <h2>Improvement Settings</h2>

                    <div class="muted mb-20">
                        {#if testCaseCount > 0}
                            {testCaseCount} test case{testCaseCount !== 1 ? "s" : ""} will be used for benchmarking.
                        {:else}
                            No test cases found. Add test cases first.
                        {/if}
                    </div>

                    <div class="form-group">
                        <label for="max-iterations">Max iterations</label>
                        <div class="range-row">
                            <input type="range" id="max-iterations" min="1" max="10" bind:value={maxIterations} />
                            <span class="range-value">{maxIterations}</span>
                        </div>
                        <small>Each iteration tests, analyzes, and improves the prompt</small>
                    </div>

                    <div class="form-group">
                        <label for="runs-per-llm">Runs per LLM per test</label>
                        <div class="range-row">
                            <input type="range" id="runs-per-llm" min="1" max="5" bind:value={runsPerLlm} />
                            <span class="range-value">{runsPerLlm}</span>
                        </div>
                        <small>More runs = more reliable scores, but takes longer</small>
                    </div>

                    <div id="improvement-model-selection" class="model-selection-section form-group">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label>
                            Improvement Model
                            <span class="muted">(picks one to rewrite the prompt)</span>
                        </label>
                        <ModelSelector
                            selectedModels={improvementModel}
                            onchange={(models) => {
                                improvementModel = models.length > 0 ? [models[models.length - 1]] : [];
                            }}
                            mode="radio"
                        />
                    </div>

                    <div id="benchmark-models-selection" class="model-selection-section form-group">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label>
                            Benchmark Models
                            <span class="muted">({benchmarkModels.length} selected)</span>
                        </label>
                        <ModelSelector
                            selectedModels={benchmarkModels}
                            onchange={(models) => benchmarkModels = models}
                        />
                    </div>

                    <button id="start-btn" onclick={startImprovement} disabled={!canStart}>
                        {running ? "Improving..." : "Start Improvement"}
                    </button>
                </div>

                <div class="card">
                    <h2>Previous Jobs</h2>
                    {#if previousJobs.length === 0}
                        <div class="muted">No improvement jobs for this prompt yet</div>
                    {:else}
                        {#each previousJobs as job}
                            <div
                                class="previous-run-item"
                                onclick={() => viewPreviousJob(job)}
                                onkeydown={(e) => e.key === "Enter" && viewPreviousJob(job)}
                                role="button"
                                tabindex="0"
                            >
                                <div class="previous-run-info">
                                    <span class="previous-run-date">{formatDate(job.createdAt)}</span>
                                    <span class="previous-run-tests">
                                        {job.currentIteration}/{job.maxIterations} iterations
                                    </span>
                                </div>
                                <div class="previous-run-status">
                                    {#if job.status === "completed" && job.bestScore !== undefined}
                                        <ScoreBadge score={job.bestScore} tooltip="Best score" />
                                    {/if}
                                    <span
                                        class="status-indicator"
                                        class:success={job.status === "completed"}
                                        class:failure={job.status === "failed"}
                                        class:pending={job.status === "pending" || job.status === "running"}
                                    >
                                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </section>

            <section class="content-col">
                {#if running || log.length > 0}
                    <div class="card">
                        <div class="progress-header">
                            <h2>Progress</h2>
                            {#if currentIteration > 0}
                                <span class="iteration-display">Iteration {currentIteration} of {maxIterations}</span>
                            {/if}
                            <span id="status-badge" class="status-indicator" class:success={!running && bestScore !== null}>
                                {running ? "Running" : "Completed"}
                            </span>
                        </div>

                        {#if originalScore !== null || bestScore !== null}
                            <div class="score-display">
                                {#if originalScore !== null}
                                    <div class="score-item">
                                        <div class="label">Original</div>
                                        <div id="original-score" class="value">{scoreToPercent(originalScore)}%</div>
                                    </div>
                                {/if}
                                {#if bestScore !== null}
                                    <div class="score-item">
                                        <div class="label">Best</div>
                                        <div id="best-score" class="value improved">{scoreToPercent(bestScore)}%</div>
                                    </div>
                                {/if}
                                {#if scoreDelta() !== null && scoreDelta()! > 0}
                                    <div class="score-item">
                                        <div class="label">Improvement</div>
                                        <div class="value improved">+{scoreDelta()}%</div>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <div id="progress-section" class="progress-section">
                            <div class="progress-label">Overall Progress</div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: {Math.round(progress)}%">
                                    {Math.round(progress)}%
                                </div>
                            </div>
                        </div>

                        <div id="log-output" class="log-container" style="margin-top: 16px;">
                            {#each log as line}
                                <div
                                    class="log-line"
                                    class:success={line.includes("✓") || line.toLowerCase().includes("success") || line.toLowerCase().includes("complete")}
                                    class:error={line.includes("✗") || line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")}
                                    class:info={line.includes("ℹ") || line.includes("→") || line.toLowerCase().includes("starting") || line.toLowerCase().includes("iteration")}
                                >
                                    {line}
                                </div>
                            {/each}
                        </div>
                    </div>

                    {#if bestPromptContent && !running}
                        <div class="improved-prompt-section">
                            <h3>✨ Improved Prompt</h3>
                            <pre>{bestPromptContent}</pre>
                            <button class="mt-20" onclick={saveAsNewVersion}>
                                Save as New Version
                            </button>
                        </div>
                    {/if}
                {:else}
                    <EmptyState
                        icon="⚡"
                        title="Ready to improve"
                        description="Configure settings and start the improvement process to see progress and results here."
                    />
                {/if}
            </section>
        </div>
    {/if}
</div>

<!-- Template Modal -->
<Modal open={templateModalOpen} title="Improvement Prompt Template" wide onclose={() => templateModalOpen = false}>
    {#if loadingTemplate}
        <div class="muted">Loading template...</div>
    {:else}
        <div class="form-group">
            <label for="template-text">Template</label>
            <textarea
                id="template-text"
                class="tall"
                bind:value={templateText}
                placeholder="Enter the improvement prompt template..."
                style="min-height: 300px;"
            ></textarea>
            <small>
                Available variables: {`{{original_prompt}}`}, {`{{test_results}}`}, {`{{test_cases}}`}
            </small>
        </div>
    {/if}

    {#snippet footer()}
        <button type="button" class="secondary" onclick={resetTemplate} disabled={loadingTemplate}>
            Reset to Default
        </button>
        <button type="button" class="secondary" onclick={() => templateModalOpen = false}>
            Cancel
        </button>
        <button type="button" onclick={saveTemplate} disabled={loadingTemplate || savingTemplate}>
            {savingTemplate ? "Saving..." : "Save Template"}
        </button>
    {/snippet}
</Modal>
