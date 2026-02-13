import type { EvaluationMode } from "../../shared/types";

/**
 * Code-first definition types for prompts and test cases.
 * Used by the builder API and by the file-scan loader for UI mode.
 */

export interface PromptDefinition {
    /** Stable id (e.g. slug from name or file path). */
    id: string;
    name: string;
    content: string;
    expectedSchema?: string | null;
    evaluationMode?: EvaluationMode;
    evaluationCriteria?: string | null;
}

export interface TestCaseDefinition {
    /** Stable id (e.g. index or hash). */
    id: string;
    input: string;
    expectedOutput: string;
    expectedOutputType: string;
}

export interface PromptSuiteDefinition {
    /** Stable id, usually same as prompt.id. */
    id: string;
    prompt: PromptDefinition;
    testCases: TestCaseDefinition[];
}
