import type { EvaluationMode } from "../../shared/types";
import type { PromptDefinition, TestCaseDefinition, PromptSuiteDefinition } from "./types";

function slugify(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/**
 * Create a prompt definition for use in code. id is derived from name if not provided.
 */
export function definePrompt(options: {
    name: string;
    content: string;
    expectedSchema?: string | null;
    evaluationMode?: EvaluationMode;
    evaluationCriteria?: string | null;
    id?: string;
}): PromptDefinition {
    const slug = slugify(options.name);
    const id = options.id ?? (slug ? slug : "prompt");
    return {
        id,
        name: options.name,
        content: options.content,
        expectedSchema: options.expectedSchema ?? null,
        evaluationMode: options.evaluationMode ?? "schema",
        evaluationCriteria: options.evaluationCriteria ?? null,
    };
}

/**
 * Create a test case definition. id is derived from index when building a suite if not provided.
 */
export function defineTestCase(options: {
    input: string;
    expectedOutput: string;
    expectedOutputType?: string;
    id?: string;
}): TestCaseDefinition {
    const id = options.id ?? `tc-${options.input.slice(0, 32).replace(/\s+/g, "-")}`;
    return {
        id,
        input: options.input,
        expectedOutput: options.expectedOutput,
        expectedOutputType: options.expectedOutputType ?? "string",
    };
}

/**
 * Create a suite (one prompt + its test cases). Gives stable ids to test cases if missing.
 */
export function defineSuite(options: {
    prompt: PromptDefinition;
    testCases: TestCaseDefinition[];
    id?: string;
}): PromptSuiteDefinition {
    const suiteId = options.id ?? options.prompt.id;
    const testCases = options.testCases.map((tc, index) =>
        tc.id ? tc : { ...tc, id: `${suiteId}-tc-${index}` }
    );
    return {
        id: suiteId,
        prompt: options.prompt,
        testCases,
    };
}
