import { getConfig } from "../database";
import { DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE } from "../constants";

export { DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE };

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

export interface LLMClient {
    name: string;
    isConfigured(): boolean;
    listModels(): Promise<ModelInfo[]>;
    complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string>;
    improvePrompt(
        currentPrompt: string,
        testResults: TestResultSummary[],
        modelId: string
    ): Promise<string>;
}

export interface TestResultSummary {
    input: string;
    expectedOutput: string;
    actualOutput: string | null;
    isCorrect: boolean;
    score: number;
    expectedFound: number;
    expectedTotal: number;
    unexpectedCount: number;
    error?: string;
}

export interface LLMConfig {
    openaiApiKey?: string;
    bedrockAccessKeyId?: string;
    bedrockSecretAccessKey?: string;
    bedrockRegion?: string;
    deepseekApiKey?: string;
}

let activeClients: LLMClient[] = [];

export function getActiveClients(): LLMClient[] {
    return activeClients;
}

export function setActiveClients(clients: LLMClient[]): void {
    activeClients = clients;
}

export function getConfiguredClients(): LLMClient[] {
    return activeClients.filter((client) => client.isConfigured());
}

export interface ModelSelection {
    provider: string;
    modelId: string;
}

export async function getAllAvailableModels(): Promise<ModelInfo[]> {
    const configuredClients = getConfiguredClients();
    const modelPromises = configuredClients.map((client) => client.listModels());
    const modelArrays = await Promise.all(modelPromises);
    return modelArrays.flat();
}

function getFailureType(test: TestResultSummary): string {
    const hasMissing = test.expectedFound < test.expectedTotal;
    const hasExtra = test.unexpectedCount > 0;

    if (hasMissing && hasExtra) {
        return "Partial match (missing + extra items)";
    } else if (hasMissing) {
        return "Missing items";
    } else if (hasExtra) {
        return "Extra items";
    }
    return "Value mismatch";
}

function formatTestMetrics(test: TestResultSummary): string {
    const lines: string[] = [];
    lines.push(`Score: ${test.score}%`);
    lines.push(`Expected items: ${test.expectedFound}/${test.expectedTotal} found`);
    if (test.unexpectedCount > 0) {
        lines.push(`Unexpected items: ${test.unexpectedCount}`);
    }
    lines.push(`Issue: ${getFailureType(test)}`);
    return lines.map((line) => `- ${line}`).join("\n");
}

export function getImprovementPromptTemplate(): string {
    return getConfig("improvement_prompt_template") || DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE;
}

export function buildImprovementPrompt(
    currentPrompt: string,
    testResults: TestResultSummary[]
): string {
    const template = getImprovementPromptTemplate();

    const failedTests = testResults.filter((t) => !t.isCorrect);
    const passedTests = testResults.filter((t) => t.isCorrect);

    // Calculate aggregate metrics
    const avgScore =
        testResults.length > 0
            ? Math.round(testResults.reduce((sum, t) => sum + t.score, 0) / testResults.length)
            : 0;

    // Categorize failures
    const missingItemTests = failedTests.filter((t) => t.expectedFound < t.expectedTotal);
    const extraItemTests = failedTests.filter((t) => t.unexpectedCount > 0);

    // Build test summary
    const testSummary = `- Passed: ${passedTests.length}/${testResults.length}
- Failed: ${failedTests.length}/${testResults.length}
- Average Score: ${avgScore}%`;

    // Build failure analysis
    const failureAnalysis = `- Tests with missing items: ${missingItemTests.length}
- Tests with extra/unexpected items: ${extraItemTests.length}`;

    // Build failed test cases section
    let failedTestCases = "";
    if (failedTests.length > 0) {
        failedTestCases = `## Failed Test Cases:\n`;
        for (const test of failedTests.slice(0, 10)) {
            failedTestCases += `
### Test (Score: ${test.score}%)
${formatTestMetrics(test)}

**Input:**
${test.input}

**Expected Output:**
${test.expectedOutput}

**Actual Output:**
${test.actualOutput ?? "ERROR: " + (test.error ?? "Unknown error")}

---
`;
        }
    }

    // Build analysis hints based on failure types
    const hints: string[] = [];
    if (missingItemTests.length > 0) {
        hints.push(
            `- ${missingItemTests.length} tests are missing expected items - ensure the prompt covers all required fields/values`
        );
    }
    if (extraItemTests.length > 0) {
        hints.push(
            `- ${extraItemTests.length} tests have extra items - ensure the prompt doesn't add unnecessary fields/values`
        );
    }
    const analysisHints =
        hints.length > 0 ? `Based on the failure analysis:\n${hints.join("\n")}` : "";

    // Replace placeholders in template
    return template
        .replace(/\{\{CURRENT_PROMPT\}\}/g, currentPrompt)
        .replace(/\{\{TEST_SUMMARY\}\}/g, testSummary)
        .replace(/\{\{FAILURE_ANALYSIS\}\}/g, failureAnalysis)
        .replace(/\{\{FAILED_TEST_CASES\}\}/g, failedTestCases)
        .replace(/\{\{ANALYSIS_HINTS\}\}/g, analysisHints);
}
