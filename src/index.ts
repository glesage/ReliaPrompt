import type { EvaluationMode } from "../shared/types";
import { setConfigOverlay, clearConfigOverlay } from "./runtime/config";
import type { ReliaPromptInitOptions, ProviderCredentials } from "./runtime/types";
import {
    getConfiguredClients,
    getClient,
    type LLMClient,
    type ModelSelection,
} from "./llm-clients";
import {
    runTests,
    type ModelRunner,
    type LLMTestResult,
    type TestCaseResult,
    type RunResult,
    type TestResults,
    type EvaluationIssue,
    type BaseTestResult,
} from "./services/test-runner";
import { compare } from "./utils/compare";
import { parse, ParseType } from "./utils/parse";
import { ConfigurationError } from "./errors";
import type { PromptDefinition, TestCaseDefinition, PromptSuiteDefinition } from "./definitions";

export type { ReliaPromptInitOptions, ProviderCredentials } from "./runtime/types";
export type { PromptDefinition, TestCaseDefinition, PromptSuiteDefinition } from "./definitions";
export { definePrompt, defineTestCase, defineSuite } from "./definitions";
export type { ModelSelection, LLMClient, ModelInfo } from "./llm-clients";
export type {
    LLMTestResult,
    TestCaseResult,
    RunResult,
    TestResults,
    EvaluationIssue,
    BaseTestResult,
} from "./services/test-runner";
export { ParseType } from "./utils/parse";
export { compare } from "./utils/compare";
export { parse } from "./utils/parse";

export interface PromptLike {
    content: string;
    expectedSchema?: string | null;
    evaluationMode?: EvaluationMode;
    evaluationCriteria?: string | null;
    id?: number;
}

export interface TestCaseLike {
    input: string;
    expectedOutput: string;
    expectedOutputType: string;
    id?: number;
}

export interface RunPromptTestsOptions {
    testModels: ModelSelection[];
    evaluationModel?: ModelSelection;
    runsPerTest?: number;
}

export function initializeReliaPrompt(options: ReliaPromptInitOptions): void {
    if (options.providers) {
        setConfigOverlay(options.providers);
    } else {
        clearConfigOverlay();
    }
}

export function resetReliaPrompt(): void {
    clearConfigOverlay();
}

function inferExpectedOutputType(expectedOutput: string): ParseType {
    const trimmedOutput = expectedOutput.trim();
    try {
        const parsed = JSON.parse(trimmedOutput);
        if (Array.isArray(parsed)) {
            return ParseType.ARRAY;
        }
        if (parsed !== null && typeof parsed === "object") {
            return ParseType.OBJECT;
        }
    } catch {}
    return ParseType.STRING;
}

function normalizeExpectedOutputType(
    expectedOutputType: string | undefined,
    expectedOutput: string
): ParseType {
    if (expectedOutputType === ParseType.STRING) {
        return ParseType.STRING;
    }
    if (expectedOutputType === ParseType.ARRAY) {
        return ParseType.ARRAY;
    }
    if (expectedOutputType === ParseType.OBJECT) {
        return ParseType.OBJECT;
    }
    return inferExpectedOutputType(expectedOutput);
}

function getModelRunnersFromSelections(selectedModels: ModelSelection[]): ModelRunner[] {
    const runners: ModelRunner[] = [];

    for (const selection of selectedModels) {
        const client = getClient(selection.provider);
        if (client?.isConfigured()) {
            runners.push({
                client,
                modelId: selection.modelId,
                displayName: `${client.providerId} (${selection.modelId})`,
            });
        }
    }

    return runners;
}

export async function runPromptTests(
    prompt: PromptLike | string,
    testCases: TestCaseLike[],
    options: RunPromptTestsOptions
): Promise<{ score: number; results: LLMTestResult[] }> {
    const { testModels, evaluationModel, runsPerTest = 1 } = options;

    if (!testModels || testModels.length === 0) {
        throw new ConfigurationError(
            "runPromptTests requires at least one model in options.testModels."
        );
    }

    const modelRunners = getModelRunnersFromSelections(testModels);
    if (modelRunners.length === 0) {
        throw new ConfigurationError(
            "No LLM clients are configured for the given testModels. Call initializeReliaPrompt({ providers: { ... } }) with the required API keys."
        );
    }

    const promptObj = typeof prompt === "string" ? { content: prompt } : prompt;
    const evaluationMode = promptObj.evaluationMode ?? "schema";

    let evaluationModelRunner: ModelRunner | undefined;
    if (evaluationMode === "llm") {
        if (!evaluationModel) {
            throw new ConfigurationError(
                "evaluationModel is required when the prompt uses evaluationMode: 'llm'."
            );
        }
        const runners = getModelRunnersFromSelections([evaluationModel]);
        evaluationModelRunner = runners[0];
        if (!evaluationModelRunner) {
            throw new ConfigurationError(
                `Evaluation model ${evaluationModel.provider} (${evaluationModel.modelId}) is not available. Configure the provider API key.`
            );
        }
    }

    const normalizedCases = testCases.map((tc, i) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        expectedOutputType: tc.expectedOutputType,
        id: tc.id ?? i,
    }));

    return runTests(
        promptObj as PromptLike & { id?: number },
        normalizedCases,
        modelRunners,
        runsPerTest,
        undefined,
        evaluationModelRunner
    );
}

export async function runPromptTestsFromSuite(
    suite: PromptSuiteDefinition,
    options: RunPromptTestsOptions
): Promise<{ score: number; results: LLMTestResult[] }> {
    const promptLike: PromptLike = {
        content: suite.prompt.content,
        expectedSchema: suite.prompt.expectedSchema,
        evaluationMode: suite.prompt.evaluationMode,
        evaluationCriteria: suite.prompt.evaluationCriteria,
    };
    const testCasesLike: TestCaseLike[] = suite.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        expectedOutputType: normalizeExpectedOutputType(tc.expectedOutputType, tc.expectedOutput),
    }));
    return runPromptTests(promptLike, testCasesLike, options);
}
