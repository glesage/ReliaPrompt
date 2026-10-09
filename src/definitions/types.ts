import type { EvaluationMode } from "../../shared/types";
import type { TestCaseResult } from "../services/result-types";

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
    /** Shown to the LLM judge instead of `content`, so prompt versions share one standard. */
    evaluationTask?: string | null;
    /** Times the LLM judge evaluates each output; the scores are averaged. */
    evaluationSamples?: number;
}

export interface TestCaseDefinition {
    /** Stable id (e.g. index or hash). */
    id: string;
    input: string;
    expectedOutput: string;
    expectedOutputType: string;
    ignoredOutputKeys?: string[];
    /** Shown to the LLM judge instead of `input`. */
    evaluationInput?: string;
}

/** Computed over all of a model's results, for checks that span test cases. */
export interface SuiteMetricDefinition {
    name: string;
    compute: (testCaseResults: TestCaseResult[]) => string | number;
}

export interface PromptSuiteDefinition {
    /** Stable id, usually same as prompt.id. */
    id: string;
    prompt: PromptDefinition;
    testCases: TestCaseDefinition[];
    metrics?: SuiteMetricDefinition[];
}
