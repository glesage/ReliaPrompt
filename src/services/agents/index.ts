import { LLMClient } from "../../llm-clients";
import { Suggestion } from "../../database";
import {
    FAILURE_ANALYZER_AGENT_PROMPT,
    SUGGESTION_ANALYZER_AGENT_PROMPT,
    DECISION_AGENT_PROMPT,
    UNDO_AGENT_PROMPT,
    SUGGESTION_AGENT_PROMPT,
    IMPLEMENT_AGENT_PROMPT,
} from "../../constants";
import { LLMTestResult, getTestResultSummary } from "../test-runner";

// ============================================================================
// Types
// ============================================================================

export interface FailureSummary {
    overallScore: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageDurationMs: number;
    timingAnalysis: string;
    failurePatterns: string[];
    criticalIssues: string[];
    missingItemsAnalysis: string;
    extraItemsAnalysis: string;
    recommendations: string[];
}

export interface SuggestionSummary {
    totalSuggestions: number;
    appliedCount: number;
    undoneCount: number;
    pendingCount: number;
    successfulPatterns: string[];
    unsuccessfulPatterns: string[];
    suggestionsToAvoid: string[];
    promisingDirections: string[];
}

export interface Decision {
    action: "undo" | "continue";
    rationale: string;
    confidence: number;
    suggestionIdsToUndo?: number[];
    undoRationale?: string;
}

export interface ProposedSuggestion {
    content: string;
    rationale: string;
    targetedFailure: string;
    priority: "high" | "medium" | "low";
}

// ============================================================================
// Agent Runner - Generic LLM call with JSON parsing
// ============================================================================

interface AgentRunner {
    client: LLMClient;
    modelId: string;
}

async function runAgent<T>(
    runner: AgentRunner,
    systemPrompt: string,
    userMessage: string = "Execute your task."
): Promise<T> {
    const response = await runner.client.complete(systemPrompt, userMessage, runner.modelId);

    // Try to parse as JSON
    try {
        // Remove any markdown code blocks if present
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse.slice(7);
        } else if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith("```")) {
            cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();

        return JSON.parse(cleanedResponse) as T;
    } catch {
        throw new Error(`Failed to parse agent response as JSON: ${response.substring(0, 200)}...`);
    }
}

async function runAgentRaw(
    runner: AgentRunner,
    systemPrompt: string,
    userMessage: string = "Execute your task."
): Promise<string> {
    return await runner.client.complete(systemPrompt, userMessage, runner.modelId);
}

// ============================================================================
// Failure Analyzer Agent
// ============================================================================

function formatTestResultsForAgent(testResults: LLMTestResult[]): string {
    const summary = getTestResultSummary(testResults);
    let output = "";

    for (const result of summary) {
        output += `\n### Test Case\n`;
        output += `- Input: ${result.input}\n`;
        output += `- Expected: ${result.expectedOutput}\n`;
        output += `- Actual: ${result.actualOutput ?? "ERROR"}\n`;
        output += `- Correct: ${result.isCorrect ? "Yes" : "No"}\n`;
        output += `- Score: ${(result.score * 100).toFixed(1)}%\n`;
        output += `- Expected Found: ${result.expectedFound}/${result.expectedTotal}\n`;
        if (result.unexpectedFound > 0) {
            output += `- Unexpected Items: ${result.unexpectedFound}\n`;
        }
        output += "\n";
    }

    return output;
}

function getTimingStats(testResults: LLMTestResult[]): {
    avgMs: number;
    minMs: number;
    maxMs: number;
    totalMs: number;
} {
    const allDurations: number[] = [];

    for (const llmResult of testResults) {
        if (llmResult.durationStats) {
            // Use the average for this LLM
            allDurations.push(llmResult.durationStats.avgMs);
        }
    }

    if (allDurations.length === 0) {
        return { avgMs: 0, minMs: 0, maxMs: 0, totalMs: 0 };
    }

    const totalMs = allDurations.reduce((sum, d) => sum + d, 0);
    return {
        avgMs: Math.round(totalMs / allDurations.length),
        minMs: Math.min(...allDurations),
        maxMs: Math.max(...allDurations),
        totalMs,
    };
}

function formatTimingStatsForAgent(testResults: LLMTestResult[]): string {
    const stats = getTimingStats(testResults);
    return `- Average execution time: ${stats.avgMs}ms
- Min execution time: ${stats.minMs}ms
- Max execution time: ${stats.maxMs}ms`;
}

export function getAverageDuration(testResults: LLMTestResult[]): number {
    return getTimingStats(testResults).avgMs;
}

export async function analyzeFailures(
    runner: AgentRunner,
    testResults: LLMTestResult[]
): Promise<FailureSummary> {
    const testResultsFormatted = formatTestResultsForAgent(testResults);
    const timingStats = formatTimingStatsForAgent(testResults);
    const prompt = FAILURE_ANALYZER_AGENT_PROMPT.replace(
        "{{TEST_RESULTS}}",
        testResultsFormatted
    ).replace("{{TIMING_STATS}}", timingStats);

    return await runAgent<FailureSummary>(runner, prompt);
}

// ============================================================================
// Suggestion Analyzer Agent
// ============================================================================

function formatSuggestionHistoryForAgent(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) {
        return "No previous suggestions.";
    }

    let output = "";
    for (const suggestion of suggestions) {
        output += `\n### Suggestion #${suggestion.id} (Iteration ${suggestion.iteration})\n`;
        output += `- Content: ${suggestion.content}\n`;
        if (suggestion.rationale) {
            output += `- Rationale: ${suggestion.rationale}\n`;
        }
        output += `- Status: ${suggestion.status}\n`;
        if (suggestion.appliedAt) {
            output += `- Applied At: ${suggestion.appliedAt}\n`;
        }
        if (suggestion.undoneAt) {
            output += `- Undone At: ${suggestion.undoneAt}\n`;
        }
        output += "\n";
    }

    return output;
}

export async function analyzeSuggestions(
    runner: AgentRunner,
    suggestions: Suggestion[]
): Promise<SuggestionSummary> {
    const suggestionHistoryFormatted = formatSuggestionHistoryForAgent(suggestions);
    const prompt = SUGGESTION_ANALYZER_AGENT_PROMPT.replace(
        "{{SUGGESTION_HISTORY}}",
        suggestionHistoryFormatted
    );

    return await runAgent<SuggestionSummary>(runner, prompt);
}

// ============================================================================
// Decision Agent
// ============================================================================

function formatAppliedSuggestionsForAgent(suggestions: Suggestion[]): string {
    const applied = suggestions.filter((s) => s.status === "applied");
    if (applied.length === 0) {
        return "No applied suggestions to consider for undo.";
    }

    let output = "";
    for (const suggestion of applied) {
        output += `\n### Suggestion #${suggestion.id} (Iteration ${suggestion.iteration})\n`;
        output += `- Content: ${suggestion.content}\n`;
        if (suggestion.rationale) {
            output += `- Rationale: ${suggestion.rationale}\n`;
        }
        output += `- Applied At: ${suggestion.appliedAt}\n`;
        output += "\n";
    }

    return output;
}

export interface TimingMetrics {
    currentDurationMs: number;
    previousDurationMs: number;
    originalDurationMs: number;
}

export async function makeDecision(
    runner: AgentRunner,
    currentScore: number,
    previousScore: number,
    failureSummary: FailureSummary,
    suggestionSummary: SuggestionSummary,
    suggestions: Suggestion[],
    timing: TimingMetrics
): Promise<Decision> {
    const appliedSuggestionsFormatted = formatAppliedSuggestionsForAgent(suggestions);

    const prompt = DECISION_AGENT_PROMPT.replace(
        "{{CURRENT_SCORE}}",
        `${(currentScore * 100).toFixed(1)}%`
    )
        .replace("{{PREVIOUS_SCORE}}", `${(previousScore * 100).toFixed(1)}%`)
        .replace("{{CURRENT_DURATION_MS}}", String(timing.currentDurationMs))
        .replace("{{PREVIOUS_DURATION_MS}}", String(timing.previousDurationMs))
        .replace("{{ORIGINAL_DURATION_MS}}", String(timing.originalDurationMs))
        .replace("{{FAILURE_SUMMARY}}", JSON.stringify(failureSummary, null, 2))
        .replace("{{SUGGESTION_SUMMARY}}", JSON.stringify(suggestionSummary, null, 2))
        .replace("{{APPLIED_SUGGESTIONS}}", appliedSuggestionsFormatted);

    return await runAgent<Decision>(runner, prompt);
}

// ============================================================================
// Undo Agent
// ============================================================================

export async function generateUndoPrompt(
    runner: AgentRunner,
    currentPrompt: string,
    originalPrompt: string,
    changesToUndo: Suggestion[],
    undoRationale: string
): Promise<string> {
    const changesToUndoFormatted = changesToUndo
        .map((s) => `- ${s.content}${s.rationale ? ` (Rationale: ${s.rationale})` : ""}`)
        .join("\n");

    const prompt = UNDO_AGENT_PROMPT.replace("{{CURRENT_PROMPT}}", currentPrompt)
        .replace("{{ORIGINAL_PROMPT}}", originalPrompt)
        .replace("{{CHANGES_TO_UNDO}}", changesToUndoFormatted)
        .replace("{{UNDO_RATIONALE}}", undoRationale);

    return await runAgentRaw(runner, prompt);
}

// ============================================================================
// Suggestion Agent
// ============================================================================

export async function proposeSuggestions(
    runner: AgentRunner,
    currentPrompt: string,
    failureSummary: FailureSummary,
    suggestionSummary: SuggestionSummary
): Promise<ProposedSuggestion[]> {
    const prompt = SUGGESTION_AGENT_PROMPT.replace("{{CURRENT_PROMPT}}", currentPrompt)
        .replace("{{PROMPT_LENGTH}}", String(currentPrompt.length))
        .replace("{{FAILURE_SUMMARY}}", JSON.stringify(failureSummary, null, 2))
        .replace("{{SUGGESTION_SUMMARY}}", JSON.stringify(suggestionSummary, null, 2));

    const result = await runAgent<{ suggestions: ProposedSuggestion[] }>(runner, prompt);
    return result.suggestions;
}

// ============================================================================
// Implement Agent
// ============================================================================

export async function implementSuggestions(
    runner: AgentRunner,
    currentPrompt: string,
    suggestions: ProposedSuggestion[]
): Promise<string> {
    const suggestionsFormatted = suggestions
        .map(
            (s, i) =>
                `${i + 1}. ${s.content}\n   Rationale: ${s.rationale}\n   Priority: ${s.priority}`
        )
        .join("\n\n");

    const prompt = IMPLEMENT_AGENT_PROMPT.replace("{{CURRENT_PROMPT}}", currentPrompt)
        .replace("{{PROMPT_LENGTH}}", String(currentPrompt.length))
        .replace("{{SUGGESTIONS}}", suggestionsFormatted);

    return await runAgentRaw(runner, prompt);
}

// ============================================================================
// Convenience type for agent runner
// ============================================================================

export type { AgentRunner };
