export interface LLMClient {
    name: string;
    isConfigured(): boolean;
    complete(systemPrompt: string, userMessage: string): Promise<string>;
    improvePrompt(currentPrompt: string, testResults: TestResultSummary[]): Promise<string>;
}

export interface TestResultSummary {
    input: string;
    expectedOutput: string;
    actualOutput: string | null;
    isCorrect: boolean;
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

export function buildImprovementPrompt(
    currentPrompt: string,
    testResults: TestResultSummary[]
): string {
    const failedTests = testResults.filter((t) => !t.isCorrect);
    const passedTests = testResults.filter((t) => t.isCorrect);

    let prompt = `You are an expert prompt engineer. Your task is to improve the following prompt to make it produce better, more accurate JSON outputs.

## Current Prompt:
${currentPrompt}

## Test Results Summary:
- Passed: ${passedTests.length}/${testResults.length}
- Failed: ${failedTests.length}/${testResults.length}

`;

    if (failedTests.length > 0) {
        prompt += `## Failed Test Cases:\n`;
        for (const test of failedTests.slice(0, 10)) {
            prompt += `
### Test Input:
${test.input}

### Expected Output:
${test.expectedOutput}

### Actual Output:
${test.actualOutput ?? "ERROR: " + (test.error ?? "Unknown error")}

---
`;
        }
    }

    prompt += `
## Your Task:
Analyze why the prompt is failing for these test cases and provide an improved version of the prompt.
The improved prompt should:
1. Be clearer and more specific about the expected output format
2. Handle edge cases better
3. Produce valid JSON that exactly matches the expected structure

IMPORTANT: Return ONLY the improved prompt text, nothing else. Do not include any explanations, markdown formatting, or code blocks. Just the raw prompt text.`;

    return prompt;
}
