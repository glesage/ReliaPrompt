<script lang="ts">
    import { selectedPrompt } from "$lib/stores/prompts";
    import { selectedModels, initModels } from "$lib/stores/models";
    import { showSuccess, showError, showInfo } from "$lib/stores/messages";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ScoreBadge from "$lib/components/ScoreBadge.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import type { TestCase, TestJob, TestResults, LLMResult, SelectedModel } from "$lib/types";
    import * as api from "$lib/api";
    import { onMount } from "svelte";

    // State
    let testCaseCount = $state(0);
    let runsPerTest = $state(1);
    let running = $state(false);
    let progress = $state(0);
    let progressDetails = $state("");
    let results = $state<TestResults | null>(null);
    let previousRuns = $state<TestJob[]>([]);
    let storedLlmResults = $state<Record<string, LLMResult>>({});
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Test details modal
    let detailsModalOpen = $state(false);
    let detailsLlm = $state<LLMResult | null>(null);
    let showAllRuns = $state(false);

    // Load test cases when prompt changes
    $effect(() => {
        if ($selectedPrompt) {
            loadTestCaseCount($selectedPrompt.id);
            loadPreviousRuns($selectedPrompt.id);
        } else {
            testCaseCount = 0;
            previousRuns = [];
            results = null;
        }
    });

    async function loadTestCaseCount(promptId: number) {
        try {
            const testCases = await api.getTestCases(promptId);
            testCaseCount = testCases.length;
        } catch {
            testCaseCount = 0;
        }
    }

    async function loadPreviousRuns(promptId: number) {
        try {
            previousRuns = await api.getTestJobs(promptId);
        } catch {
            previousRuns = [];
        }
    }

    async function runTests() {
        if (!$selectedPrompt || $selectedModels.length === 0) return;

        running = true;
        progress = 0;
        progressDetails = "";
        results = null;
        showInfo("Starting test run...");

        try {
            const { jobId } = await api.startTestRun({
                promptId: $selectedPrompt.id,
                runsPerTest,
                selectedModels: $selectedModels,
            });
            pollProgress(jobId);
        } catch (error) {
            showError((error as Error).message);
            running = false;
        }
    }

    function pollProgress(jobId: string) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const status = await api.getTestStatus(jobId);
                progress = status.progress || 0;
                progressDetails = `${status.completedTests || 0} / ${status.totalTests || 0} tests completed`;

                if (status.status === "completed") {
                    clearInterval(pollInterval!);
                    running = false;
                    if (status.results) {
                        showResults(status.results);
                    }
                    if ($selectedPrompt) {
                        loadPreviousRuns($selectedPrompt.id);
                    }
                } else if (status.status === "failed") {
                    clearInterval(pollInterval!);
                    running = false;
                    showError(status.error || "Test run failed");
                    if ($selectedPrompt) {
                        loadPreviousRuns($selectedPrompt.id);
                    }
                }
            } catch {
                showError("Error checking test status");
            }
        }, 1000);
    }

    function showResults(testResults: TestResults) {
        results = testResults;
        storedLlmResults = {};
        for (const llm of testResults.llmResults) {
            storedLlmResults[llm.llmName] = llm;
        }
    }

    async function viewPreviousRun(jobId: string) {
        try {
            const status = await api.getTestStatus(jobId);
            if (status.results) {
                showResults(status.results);
            } else {
                showInfo("No results available for this test run");
            }
        } catch {
            showError("Error loading test run results");
        }
    }

    function openTestDetailsModal(llmName: string) {
        const llm = storedLlmResults[llmName];
        if (llm) {
            detailsLlm = llm;
            showAllRuns = false;
            detailsModalOpen = true;
        }
    }

    function closeTestDetailsModal() {
        detailsModalOpen = false;
        detailsLlm = null;
    }

    function formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }

    function scoreToPercent(score: number): number {
        if (score > 1) return score;
        return Math.round(score * 100);
    }

    function getBestScore(llmResults: LLMResult[]): number | null {
        if (!llmResults || llmResults.length === 0) return null;
        return scoreToPercent(Math.max(...llmResults.map((llm) => llm.score)));
    }

    function escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text ?? "";
        return div.innerHTML;
    }

    function formatJSON(json: string): string {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch {
            return json;
        }
    }

    const canRun = $derived(testCaseCount > 0 && $selectedModels.length > 0 && !running);

    onMount(() => {
        initModels();
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    });
</script>

<header class="content-header">
    <div class="content-header-main">
        <h1 class="content-title">Test Runs</h1>
        <p class="content-subtitle">Run your prompt against selected models and inspect results.</p>
    </div>
</header>

<div class="content-body">
    {#if !$selectedPrompt}
        <EmptyState
            icon="🚀"
            title="Select a prompt"
            description="Pick a prompt on the left to run tests and compare LLM outputs."
        />
    {:else}
        <div id="test-section" class="content-grid">
            <section class="content-col">
                <div class="card">
                    <div class="card-header">
                        <h2>Run tests for "{$selectedPrompt.name}"</h2>
                    </div>

                    <div class="muted mb-20">
                        {#if testCaseCount > 0}
                            {testCaseCount} test case{testCaseCount !== 1 ? "s" : ""} will be run {runsPerTest} time{runsPerTest !== 1 ? "s" : ""} each across selected models
                        {:else}
                            No test cases found. Add test cases first.
                        {/if}
                    </div>
                    <div class="helper-note mb-20">Test cases are shared across all versions of this prompt.</div>

                    <div class="mb-20">
                        <label for="runs-per-test">Runs per test case</label>
                        <div class="range-row">
                            <input type="range" id="runs-per-test" min="1" max="10" bind:value={runsPerTest} />
                            <span class="range-value">{runsPerTest}</span>
                        </div>
                        <small>More runs = more reliable results, but takes longer</small>
                    </div>

                    <div id="test-models-selection" class="model-selection-section mb-20">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label>
                            Models to test
                            <span class="muted">({$selectedModels.length} selected)</span>
                        </label>
                        <ModelSelector
                            selectedModels={$selectedModels}
                            onchange={(models) => selectedModels.set(models)}
                        />
                    </div>

                    <button id="run-btn" onclick={runTests} disabled={!canRun}>
                        {running ? "Running..." : "Run Tests"}
                    </button>

                    {#if running}
                        <div id="progress-section" class="progress-section">
                            <div class="progress-label">Overall Progress</div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: {progress}%">{progress}%</div>
                            </div>
                            <div class="muted" style="font-size: 14px">{progressDetails}</div>
                        </div>
                    {/if}
                </div>
            </section>

            <section class="content-col">
                {#if results}
                    <div id="results-section" class="card">
                        <h2>
                            Results
                            <span id="overall-score-badge"><ScoreBadge score={results.overallScore} tooltip="Overall" /></span>
                            {#if getBestScore(results.llmResults) !== null}
                                <ScoreBadge score={getBestScore(results.llmResults)! / 100} tooltip="Best LLM" variant="best" />
                            {/if}
                        </h2>
                        <div id="llm-results" class="llm-results">
                            {#each results.llmResults as llm}
                                <div class="llm-result-row">
                                    <span class="llm-result-name">{llm.llmName}</span>
                                    <ScoreBadge score={llm.score} />
                                    {#if llm.durationStats}
                                        <span class="duration-badge" title="Average response time">
                                            ⏱ {formatDuration(llm.durationStats.avgMs)}
                                        </span>
                                    {/if}
                                    <button
                                        class="btn-view-details"
                                        onclick={() => openTestDetailsModal(llm.llmName)}
                                        title="View details"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="card">
                    <h2>Previous Test Runs</h2>
                    <div>
                        {#if previousRuns.length === 0}
                            <div class="muted">No previous test runs for this prompt</div>
                        {:else}
                            {#each previousRuns as job}
                                <div
                                    class="previous-run-item"
                                    onclick={() => viewPreviousRun(job.id)}
                                    onkeydown={(e) => e.key === "Enter" && viewPreviousRun(job.id)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="previous-run-info">
                                        <span class="previous-run-date">{formatDate(job.createdAt)}</span>
                                        <span class="previous-run-tests">{job.totalTests} tests</span>
                                    </div>
                                    <div class="previous-run-status">
                                        {#if job.status === "completed" && job.results}
                                            {@const parsed = typeof job.results === "string" ? JSON.parse(job.results) : job.results}
                                            <ScoreBadge score={parsed.overallScore} tooltip="Overall" />
                                            {#if getBestScore(parsed.llmResults) !== null}
                                                <ScoreBadge score={getBestScore(parsed.llmResults)! / 100} tooltip="Best LLM" variant="best" />
                                            {/if}
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
                </div>
            </section>
        </div>
    {/if}
</div>

<!-- Test Details Modal -->
<Modal id="test-details-modal" open={detailsModalOpen} title={detailsLlm?.llmName || "Test Details"} wide onclose={closeTestDetailsModal}>
    {#snippet titleBadge()}
        {#if detailsLlm}
            <ScoreBadge score={detailsLlm.score} />
        {/if}
    {/snippet}

    {#if detailsLlm}
        <div id="test-details-content">
        {#if detailsLlm.durationStats}
            <div style="background: var(--color-bg-elevated); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="display: block; margin-bottom: 8px;">⏱ Response Time Statistics</strong>
                <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                    <div><span style="color: var(--color-text-muted);">Min:</span> <strong>{formatDuration(detailsLlm.durationStats.minMs)}</strong></div>
                    <div><span style="color: var(--color-text-muted);">Max:</span> <strong>{formatDuration(detailsLlm.durationStats.maxMs)}</strong></div>
                    <div><span style="color: var(--color-text-muted);">Average:</span> <strong>{formatDuration(detailsLlm.durationStats.avgMs)}</strong></div>
                </div>
            </div>
        {/if}

        <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
            <button
                type="button"
                class="btn-toggle-runs"
                class:active={showAllRuns}
                onclick={() => showAllRuns = !showAllRuns}
            >
                {showAllRuns ? "Hide Individual Runs" : "Show Individual Runs"}
            </button>
        </div>

        {#each detailsLlm.testCaseResults as tc, i}
            <div class="test-case-detail">
                <div class="header">
                    <strong>#{i + 1}</strong>
                    <ScoreBadge score={tc.averageScore} />
                </div>
                <div style="margin-top: 10px; margin-bottom: 5px;"><strong>Input:</strong></div>
                <div class="json-preview">{tc.input.substring(0, 200)}{tc.input.length > 200 ? "..." : ""}</div>
                <div style="margin-top: 10px; margin-bottom: 5px;"><strong>Expected:</strong></div>
                <div class="json-preview">{formatJSON(tc.expectedOutput)}</div>

                {#if !showAllRuns && tc.runs && tc.runs.length > 0}
                    <div style="margin-top: 12px;">
                        <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px;"><strong>Run Results:</strong></div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            {#each tc.runs as run, runIdx}
                                {@const runScore = scoreToPercent(run.score || 0)}
                                {@const bgColor = runScore >= 90 ? "rgba(34, 197, 94, 0.15)" : runScore >= 80 ? "rgba(234, 179, 8, 0.15)" : "rgba(239, 68, 68, 0.15)"}
                                {@const textColor = runScore >= 90 ? "var(--color-success)" : runScore >= 80 ? "var(--color-warning)" : "var(--color-danger)"}
                                {@const icon = run.isCorrect ? "✓" : runScore >= 80 ? "◐" : "✗"}
                                <div
                                    style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: {bgColor}; font-size: 12px;"
                                    title="Run #{runIdx + 1}: {runScore}%{run.durationMs !== undefined ? ', ' + formatDuration(run.durationMs) : ''}"
                                >
                                    <span style="color: {textColor}; font-weight: bold;">{icon}</span>
                                    <span style="color: {textColor};">{runScore}%{run.durationMs !== undefined ? ` · ${formatDuration(run.durationMs)}` : ""}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if showAllRuns && tc.runs && tc.runs.length > 0}
                    <div style="margin-top: 12px; border-top: 1px solid var(--color-border); padding-top: 12px;">
                        <div style="margin-bottom: 8px; font-weight: 600; color: var(--color-text-muted);">Individual Runs:</div>
                        {#each tc.runs as run, runIdx}
                            {@const runScore = scoreToPercent(run.score || 0)}
                            {@const borderColor = runScore >= 90 ? "var(--color-success)" : runScore >= 80 ? "var(--color-warning)" : "var(--color-danger)"}
                            <div style="background: var(--color-bg-elevated); padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid {borderColor};">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                                    <span style="font-weight: 500;">Run #{runIdx + 1}</span>
                                    <ScoreBadge score={run.score} />
                                    {#if run.durationMs !== undefined}
                                        <span class="duration-badge" style="font-size: 11px; opacity: 0.8;">⏱ {formatDuration(run.durationMs)}</span>
                                    {/if}
                                </div>
                                <div style="margin-top: 6px;">
                                    <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px;">Actual Output:</div>
                                    <div class="json-preview" style="font-size: 13px; max-height: 150px; overflow-y: auto;">
                                        {run.actualOutput || (run.error ? `Error: ${run.error}` : "N/A")}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
        </div>
    {/if}

    {#snippet footer()}
        <button id="test-details-close-btn" type="button" class="secondary" onclick={closeTestDetailsModal}>Close</button>
    {/snippet}
</Modal>
