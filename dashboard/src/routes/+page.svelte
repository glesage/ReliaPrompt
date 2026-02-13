<script lang="ts">
    import {
        selectedModels,
        availableModels,
        initModels,
        saveSelectedModels,
    } from "$lib/stores/models";
    import { selectedLibrarySuite } from "$lib/stores/uiMode";
    import { showSuccess, showError, showInfo } from "$lib/stores/messages";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ScoreBadge from "$lib/components/ScoreBadge.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import type { TestResults, LLMResult, SelectedModel } from "$lib/types";
    import * as api from "$lib/api";
    import { onMount } from "svelte";

    let activeTestCaseId = $state<number | null>(null);
    let testCaseFilter = $state("");

    let runsPerTest = $state(1);
    let running = $state(false);
    let progress = $state(0);
    let progressDetails = $state("");
    let results = $state<TestResults | null>(null);
    let storedLlmResults = $state<Record<string, LLMResult>>({});
    let selectedEvaluationModels = $state<SelectedModel[]>([]);
    let detailsModalOpen = $state(false);
    let detailsLlm = $state<LLMResult | null>(null);
    let showAllRuns = $state(false);
    let selectedRunId = $state<string | null>(null);
    let displayedRunId = $state<string | null>(null);
    let runHistoryBySuite = $state<Record<string, TestRunEntry[]>>({});

    type TestRunEntry = {
        id: string;
        createdAt: number;
        runsPerTest: number;
        testCaseCount: number;
        modelCount: number;
        results: TestResults;
    };

    const currentPromptForEval = $derived($selectedLibrarySuite?.prompt);
    const isLlmEvaluationPrompt = $derived($selectedLibrarySuite?.prompt?.evaluationMode === "llm");
    const shouldShowEvaluationModelSelector = $derived(
        currentPromptForEval?.evaluationMode === "llm" &&
            Boolean(currentPromptForEval?.evaluationCriteria?.trim())
    );

    const libraryTestCases = $derived(
        $selectedLibrarySuite?.testCases.map((tc, i) => ({
            id: i,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            expectedOutputType: tc.expectedOutputType,
        })) ?? []
    );

    const filteredTestCases = $derived.by(() => {
        const q = testCaseFilter.trim().toLowerCase();
        if (!q) return libraryTestCases;
        return libraryTestCases.filter(
            (tc) =>
                tc.input.toLowerCase().includes(q) ||
                (!isLlmEvaluationPrompt && tc.expectedOutput.toLowerCase().includes(q))
        );
    });

    const testCaseCount = $derived($selectedLibrarySuite?.testCases.length ?? 0);
    const totalPlannedTests = $derived(testCaseCount * $selectedModels.length * runsPerTest);
    const currentSuiteId = $derived($selectedLibrarySuite?.id ?? null);
    const currentRunHistory = $derived(
        currentSuiteId ? (runHistoryBySuite[currentSuiteId] ?? []) : []
    );
    const selectedRun = $derived.by(() => {
        if (currentRunHistory.length === 0) return null;
        if (!selectedRunId) return currentRunHistory[0];
        return currentRunHistory.find((run) => run.id === selectedRunId) ?? currentRunHistory[0];
    });

    $effect(() => {
        if ($selectedLibrarySuite) activeTestCaseId = null;
    });
    $effect(() => {
        const nextSelectedRunId = selectedRun?.id ?? null;
        if (nextSelectedRunId !== selectedRunId) {
            selectedRunId = nextSelectedRunId;
        }

        if (!selectedRun) {
            results = null;
            storedLlmResults = {};
            displayedRunId = null;
            return;
        }

        if (displayedRunId === selectedRun.id) {
            return;
        }

        showResults(selectedRun.results);
        displayedRunId = selectedRun.id;
    });
    $effect(() => {
        if (!shouldShowEvaluationModelSelector) {
            if (selectedEvaluationModels.length > 0) {
                selectedEvaluationModels = [];
            }
            return;
        }
        const availableModelKeys = new Set($availableModels.map((m) => `${m.provider}:${m.id}`));
        const hasValid =
            selectedEvaluationModels.length > 0 &&
            availableModelKeys.has(
                `${selectedEvaluationModels[0].provider}:${selectedEvaluationModels[0].modelId}`
            );
        if (hasValid) return;
        if (selectedEvaluationModels.length > 0) {
            selectedEvaluationModels = [];
        }
    });

    const canRun = $derived(
        testCaseCount > 0 &&
            $selectedModels.length > 0 &&
            !running &&
            (!shouldShowEvaluationModelSelector || selectedEvaluationModels.length > 0)
    );

    async function runTests() {
        if (!$selectedLibrarySuite || $selectedModels.length === 0) {
            if ($selectedModels.length === 0) showError("Select at least one test model");
            return;
        }
        const prompt = $selectedLibrarySuite.prompt;
        const needsEval =
            (prompt.evaluationMode ?? "schema") === "llm" &&
            (prompt.evaluationCriteria?.trim() ?? "");
        if (needsEval && selectedEvaluationModels.length === 0) {
            showError("Select an evaluation model for LLM evaluation");
            return;
        }
        running = true;
        progress = 0;
        progressDetails = "Running...";
        showInfo("Running tests...");
        try {
            const result = await api.runLibraryTest({
                suiteId: $selectedLibrarySuite.id,
                testModels: $selectedModels,
                evaluationModel: needsEval ? selectedEvaluationModels[0] : undefined,
                runsPerTest,
            });
            progress = 100;
            progressDetails = "Done";
            const testResults: TestResults = {
                overallScore: result.score,
                evaluationModel: needsEval ? selectedEvaluationModels[0] : undefined,
                llmResults: result.results,
            };
            addRunToHistory(testResults);
            showSuccess("Test run completed");
        } catch (error) {
            showError((error as Error).message);
        } finally {
            running = false;
        }
    }

    function showResults(testResults: TestResults) {
        results = testResults;
        storedLlmResults = {};
        for (const llm of testResults.llmResults) storedLlmResults[llm.llmName] = llm;
    }

    function addRunToHistory(testResults: TestResults) {
        if (!currentSuiteId) return;
        const runEntry: TestRunEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            runsPerTest,
            testCaseCount,
            modelCount: $selectedModels.length,
            results: testResults,
        };
        runHistoryBySuite = {
            ...runHistoryBySuite,
            [currentSuiteId]: [runEntry, ...(runHistoryBySuite[currentSuiteId] ?? [])],
        };
        selectedRunId = runEntry.id;
    }

    function selectRun(runId: string) {
        selectedRunId = runId;
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

    function formatRunDate(timestampMs: number): string {
        return new Date(timestampMs).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function formatEvaluationModel(model?: SelectedModel): string | null {
        if (!model?.provider || !model?.modelId) return null;
        return `${model.provider} (${model.modelId})`;
    }

    function scoreToPercent(score: number): number {
        if (score > 1) return score;
        return Math.round(score * 100);
    }

    function getBestScore(llmResults: LLMResult[]): number | null {
        if (!llmResults?.length) return null;
        return scoreToPercent(Math.max(...llmResults.map((llm) => llm.score)));
    }

    function formatJSON(json: string): string {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch {
            return json;
        }
    }

    function getEvaluationModelValue(model: SelectedModel | undefined): string {
        if (!model) return "";
        return `${model.provider}:${model.modelId}`;
    }

    function parseEvaluationModelValue(value: string): SelectedModel | null {
        const i = value.indexOf(":");
        if (i <= 0 || i >= value.length - 1) return null;
        return { provider: value.slice(0, i), modelId: value.slice(i + 1) };
    }

    onMount(() => {
        initModels();
    });
</script>

<div class="content-body content-body-fit">
    {#if !$selectedLibrarySuite}
        <EmptyState
            icon="🗂"
            title="Select a prompt"
            description="Pick a prompt (suite) on the left to view test cases and run tests."
        />
    {:else}
        <section class="tests-section tests-section-cases" aria-label="Test cases">
            <h2 class="tests-section-title">Test cases</h2>
            <div class="split-view split-view-fit">
                <div class="split-pane split-pane-list" aria-label="Test cases list">
                    <div class="split-pane-header">
                        <div class="split-pane-title">Cases</div>
                        <input
                            type="search"
                            placeholder="Filter…"
                            autocomplete="off"
                            bind:value={testCaseFilter}
                        />
                    </div>
                    <div id="test-cases-list" class="tc-list">
                        {#if libraryTestCases.length === 0}
                            <EmptyState
                                icon="🧪"
                                title="No test cases"
                                description="Add test cases in your definition file."
                                compact
                            />
                        {:else if filteredTestCases.length === 0}
                            <EmptyState
                                icon="🔎"
                                title="No matches"
                                description="Try a different filter."
                                compact
                            />
                        {:else}
                            {#each filteredTestCases as tc (tc.id)}
                                <button
                                    class="tc-list-item"
                                    class:active={tc.id === activeTestCaseId}
                                    type="button"
                                    onclick={() => (activeTestCaseId = tc.id)}
                                >
                                    <div class="tc-list-item-top">
                                        <div class="tc-list-item-title">#{tc.id + 1}</div>
                                        {#if !isLlmEvaluationPrompt}
                                            <span class="pill pill-muted"
                                                >{tc.expectedOutputType}</span
                                            >
                                        {/if}
                                    </div>
                                    <div class="tc-list-item-preview">
                                        {tc.input.replace(/\s+/g, " ").slice(0, 120) ||
                                            "(empty input)"}
                                    </div>
                                </button>
                            {/each}
                        {/if}
                    </div>
                </div>
                <div class="split-pane split-pane-detail" aria-label="Test case view">
                    <div class="split-pane-header tc-detail-header">
                        <div class="split-pane-title">View test case</div>
                    </div>
                    <div class="tc-detail-body">
                        {#if activeTestCaseId === null}
                            <div class="tc-detail-empty">
                                <p class="muted">Test case will appear here.</p>
                            </div>
                        {:else}
                            {@const tc = libraryTestCases.find((t) => t.id === activeTestCaseId)}
                            {#if tc}
                                <div class="tc-detail-content">
                                    <div class="form-group">
                                        <!-- svelte-ignore a11y_label_has_associated_control -->
                                        <label>Input</label>
                                        <pre class="view-prompt-content">{tc.input}</pre>
                                    </div>
                                    {#if !isLlmEvaluationPrompt}
                                        <div class="form-group">
                                            <!-- svelte-ignore a11y_label_has_associated_control -->
                                            <label>Expected output ({tc.expectedOutputType})</label>
                                            <pre
                                                class="view-prompt-content">{tc.expectedOutput}</pre>
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
        </section>

        <section class="tests-section tests-section-runs" aria-label="Test runs">
            <h2 class="tests-section-title">Test runs</h2>
            <div class="split-view split-view-fit split-view-runs">
                <div class="split-pane split-pane-list" aria-label="Models to run">
                    <div class="split-pane-header">
                        <div class="split-pane-title">Models to test</div>
                    </div>
                    <div id="test-models-selection" class="run-models-body">
                        <ModelSelector
                            selectedModels={$selectedModels}
                            onchange={(models) => {
                                selectedModels.set(models);
                                saveSelectedModels();
                            }}
                        />
                        {#if shouldShowEvaluationModelSelector}
                            <div class="run-config-group">
                                <label for="evaluation-model">Evaluation model</label>
                                <select
                                    class="run-config-select"
                                    id="evaluation-model"
                                    value={getEvaluationModelValue(selectedEvaluationModels[0])}
                                    onchange={(e) => {
                                        const v = (e.currentTarget as HTMLSelectElement).value;
                                        const p = parseEvaluationModelValue(v);
                                        selectedEvaluationModels = p ? [p] : [];
                                    }}
                                >
                                    <option value="" disabled={true}
                                        >Select an evaluation model</option
                                    >
                                    {#each $availableModels as model}
                                        <option value={`${model.provider}:${model.id}`}
                                            >{model.provider} – {model.name}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        {/if}
                        <div class="run-config-hint run-config-inline">
                            <span>
                                {#if testCaseCount > 0}
                                    {testCaseCount} test{testCaseCount !== 1 ? "s" : ""} × {$selectedModels.length}
                                    model{$selectedModels.length !== 1 ? "s" : ""} ×
                                {:else}
                                    No test cases above.
                                {/if}
                            </span>
                            <div class="range-row run-config-slider-inline">
                                <input
                                    type="range"
                                    id="runs-per-test"
                                    min="1"
                                    max="10"
                                    bind:value={runsPerTest}
                                />
                                <span class="range-value">{runsPerTest}</span>
                            </div>
                            {#if testCaseCount > 0}
                                <span>run{runsPerTest !== 1 ? "s" : ""} each</span>
                            {/if}
                        </div>
                        <button
                            id="run-btn"
                            class="run-btn-primary"
                            onclick={runTests}
                            disabled={!canRun}
                        >
                            {running
                                ? `Running ${totalPlannedTests} test${totalPlannedTests !== 1 ? "s" : ""}...`
                                : `Run ${totalPlannedTests} test${totalPlannedTests !== 1 ? "s" : ""}`}
                        </button>
                    </div>
                </div>
                <div class="split-pane split-pane-detail" aria-label="Runs per case and results">
                    <div class="split-pane-header runs-detail-header">
                        <div class="split-pane-title">View test runs</div>
                    </div>
                    <div class="runs-results-body">
                        {#if running}
                            <div id="progress-section" class="progress-inline">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" style="width: {progress}%"></div>
                                </div>
                                <span class="progress-value">{progress}%</span>
                                <span class="muted">{progressDetails}</span>
                            </div>
                        {/if}
                        {#if currentRunHistory.length > 0}
                            <div class="previous-runs-list">
                                {#each currentRunHistory as run, runIndex (run.id)}
                                    <button
                                        type="button"
                                        class="previous-run-item"
                                        class:active={selectedRun?.id === run.id}
                                        onclick={() => selectRun(run.id)}
                                    >
                                        <div class="previous-run-info">
                                            <span class="previous-run-date"
                                                >Run #{currentRunHistory.length - runIndex}</span
                                            >
                                            <span class="previous-run-tests">
                                                {run.testCaseCount} case{run.testCaseCount !== 1
                                                    ? "s"
                                                    : ""} x {run.modelCount} model{run.modelCount !==
                                                1
                                                    ? "s"
                                                    : ""} x {run.runsPerTest}
                                            </span>
                                        </div>
                                        <div class="previous-run-status">
                                            <span class="previous-run-tests"
                                                >{formatRunDate(run.createdAt)}</span
                                            >
                                            <ScoreBadge
                                                score={run.results.overallScore}
                                                tooltip="Overall"
                                            />
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                        {#if results}
                            <div id="results-section" class="results-inner">
                                <h3 class="results-heading">
                                    Results
                                    <span id="overall-score-badge"
                                        ><ScoreBadge
                                            score={results.overallScore}
                                            tooltip="Overall"
                                        /></span
                                    >
                                    {#if getBestScore(results.llmResults) !== null}
                                        <ScoreBadge
                                            score={getBestScore(results.llmResults)! / 100}
                                            tooltip="Best LLM"
                                            variant="best"
                                        />
                                    {/if}
                                </h3>
                                {#if results.evaluationModel}
                                    {@const evaluationModelLabel = formatEvaluationModel(
                                        results.evaluationModel
                                    )}
                                    {#if evaluationModelLabel}
                                        <div class="muted results-judge">
                                            Judge: {evaluationModelLabel}
                                        </div>
                                    {/if}
                                {/if}
                                <div id="llm-results" class="llm-results">
                                    {#each results.llmResults as llm}
                                        <div class="llm-result-row">
                                            <span class="llm-result-name">{llm.llmName}</span>
                                            <ScoreBadge score={llm.score} />
                                            {#if llm.durationStats}
                                                <span
                                                    class="duration-badge"
                                                    title="Average response time"
                                                >
                                                    ⏱ {formatDuration(llm.durationStats.avgMs)}
                                                </span>
                                            {/if}
                                            <button
                                                class="btn-view-details"
                                                onclick={() => openTestDetailsModal(llm.llmName)}
                                                title="View details"
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <path
                                                        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                                                    />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <div class="runs-empty">
                                <p class="muted">Test results will appear here.</p>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </section>
    {/if}
</div>

<Modal
    id="test-details-modal"
    open={detailsModalOpen}
    title={detailsLlm?.llmName || "Test Details"}
    wide
    onclose={closeTestDetailsModal}
>
    {#snippet titleBadge()}
        {#if detailsLlm}
            <ScoreBadge score={detailsLlm.score} />
        {/if}
    {/snippet}

    {#if detailsLlm}
        <div id="test-details-content">
            {#if detailsLlm.durationStats}
                <div class="detail-stats">
                    <strong>⏱ Response time</strong>
                    <div class="detail-stats-row">
                        <span
                            >Min: <strong>{formatDuration(detailsLlm.durationStats.minMs)}</strong
                            ></span
                        >
                        <span
                            >Max: <strong>{formatDuration(detailsLlm.durationStats.maxMs)}</strong
                            ></span
                        >
                        <span
                            >Avg: <strong>{formatDuration(detailsLlm.durationStats.avgMs)}</strong
                            ></span
                        >
                    </div>
                </div>
            {/if}
            <div class="detail-toggle-row">
                <button
                    type="button"
                    class="btn-toggle-runs"
                    class:active={showAllRuns}
                    onclick={() => (showAllRuns = !showAllRuns)}
                >
                    {showAllRuns ? "Hide individual runs" : "Show individual runs"}
                </button>
            </div>
            {#each detailsLlm.testCaseResults as tc, i}
                <div class="test-case-detail">
                    <div class="header">
                        <strong>#{i + 1}</strong>
                        <ScoreBadge score={tc.averageScore} />
                    </div>
                    <div class="detail-label">Input:</div>
                    <div class="json-preview">
                        {tc.input.substring(0, 200)}{tc.input.length > 200 ? "..." : ""}
                    </div>
                    {#if currentPromptForEval?.evaluationMode !== "llm"}
                        <div class="detail-label">Expected:</div>
                        <div class="json-preview">{formatJSON(tc.expectedOutput)}</div>
                    {/if}
                    {#if !showAllRuns && tc.runs?.length > 0}
                        <div class="runs-badges">
                            {#each tc.runs as run, runIdx}
                                {@const runScore = scoreToPercent(run.score || 0)}
                                {@const bg =
                                    runScore >= 90
                                        ? "rgba(34, 197, 94, 0.15)"
                                        : runScore >= 80
                                          ? "rgba(234, 179, 8, 0.15)"
                                          : "rgba(239, 68, 68, 0.15)"}
                                {@const cl =
                                    runScore >= 90
                                        ? "var(--color-success)"
                                        : runScore >= 80
                                          ? "var(--color-warning)"
                                          : "var(--color-danger)"}
                                <div class="run-badge" style="background: {bg}; color: {cl};">
                                    {run.isCorrect ? "✓" : runScore >= 80 ? "◐" : "✗"}
                                    {runScore}%
                                    {#if run.durationMs != null}
                                        · {formatDuration(run.durationMs)}{/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                    {#if showAllRuns && tc.runs?.length > 0}
                        <div class="runs-expanded">
                            {#each tc.runs as run, runIdx}
                                {@const runScore = scoreToPercent(run.score || 0)}
                                {@const borderCl =
                                    runScore >= 90
                                        ? "var(--color-success)"
                                        : runScore >= 80
                                          ? "var(--color-warning)"
                                          : "var(--color-danger)"}
                                <div class="run-block" style="border-left-color: {borderCl}">
                                    <div class="run-block-header">
                                        Run #{runIdx + 1}
                                        <ScoreBadge score={run.score} />
                                        {#if run.durationMs != null}
                                            <span class="duration-badge"
                                                >⏱ {formatDuration(run.durationMs)}</span
                                            >
                                        {/if}
                                    </div>
                                    <div class="detail-label">Actual output:</div>
                                    <div class="json-preview run-output">
                                        {run.actualOutput ||
                                            (run.error ? `Error: ${run.error}` : "N/A")}
                                    </div>
                                    {#if run.reason}
                                        <div class="detail-reason">{run.reason}</div>
                                    {/if}
                                    {#if (run.issues?.length ?? 0) > 0}
                                        <div class="detail-issues">
                                            {#each run.issues as issue}
                                                <div class="issue-block">
                                                    <div class="detail-label">Substring</div>
                                                    <div class="json-preview">
                                                        {issue.substring}
                                                    </div>
                                                    <div class="detail-label">Reason</div>
                                                    <div>{issue.explanation}</div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    {#snippet footer()}
        <button
            id="test-details-close-btn"
            type="button"
            class="secondary"
            onclick={closeTestDetailsModal}>Close</button
        >
    {/snippet}
</Modal>
