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
    improvePrompt(currentPrompt: string, testResults: TestResultSummary[], modelId: string): Promise<string>;
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
    return lines.map(line => `- ${line}`).join("\n");
}

export function buildImprovementPrompt(
    currentPrompt: string,
    testResults: TestResultSummary[]
): string {
    const failedTests = testResults.filter((t) => !t.isCorrect);
    const passedTests = testResults.filter((t) => t.isCorrect);

    // Calculate aggregate metrics
    const avgScore = testResults.length > 0
        ? Math.round(testResults.reduce((sum, t) => sum + t.score, 0) / testResults.length)
        : 0;

    // Categorize failures
    const missingItemTests = failedTests.filter(t => t.expectedFound < t.expectedTotal);
    const extraItemTests = failedTests.filter(t => t.unexpectedCount > 0);

    let prompt = `You are an expert prompt engineer. Your task is to improve the following prompt to make it produce better, more accurate JSON outputs.

## Current Prompt:
${currentPrompt}

## Test Results Summary:
- Passed: ${passedTests.length}/${testResults.length}
- Failed: ${failedTests.length}/${testResults.length}
- Average Score: ${avgScore}%

## Failure Analysis:
- Tests with missing items: ${missingItemTests.length}
- Tests with extra/unexpected items: ${extraItemTests.length}

`;

    if (failedTests.length > 0) {
        prompt += `## Failed Test Cases:\n`;
        for (const test of failedTests.slice(0, 10)) {
            prompt += `
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

    prompt += `
## Your Task:
Analyze why the prompt is failing for these test cases and provide an improved version of the prompt.

Based on the failure analysis:
${missingItemTests.length > 0 ? `- ${missingItemTests.length} tests are missing expected items - ensure the prompt covers all required fields/values` : ""}
${extraItemTests.length > 0 ? `- ${extraItemTests.length} tests have extra items - ensure the prompt doesn't add unnecessary fields/values` : ""}

The improved prompt should:
1. Be clearer and more specific about the expected output format
2. Handle edge cases better
3. Produce valid JSON that exactly matches the expected structure
4. Not include extra fields or values beyond what is expected

IMPORTANT: Return ONLY the improved prompt text, nothing else. Do not include any explanations, markdown formatting, or code blocks. Just the raw prompt text.`;

    return prompt;
}
