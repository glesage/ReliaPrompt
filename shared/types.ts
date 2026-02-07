// ============================================
// Shared Types for Relia Prompt
// ============================================
// These types are shared between the frontend and backend.
// They define the API request/response interfaces.

// ============================================
// Prompt Types
// ============================================

export interface Prompt {
    id: number;
    name: string;
    content: string;
    version: number;
    promptGroupId: number;
    expectedSchema?: string | null;
    evaluationMode?: "schema" | "llm";
    evaluationCriteria?: string | null;
    createdAt: string;
}

export interface PromptGroup {
    id: number;
    name: string;
    version: number; // Latest version count
    promptGroupId: number;
}

export interface CreatePromptRequest {
    name: string;
    content: string;
    expectedSchema?: string;
    evaluationMode?: "schema" | "llm";
    evaluationCriteria?: string;
    parentVersionId?: number;
}

export interface CreateVersionRequest {
    content: string;
    expectedSchema?: string;
    evaluationMode?: "schema" | "llm";
    evaluationCriteria?: string;
}

// ============================================
// Model Types
// ============================================

export interface Model {
    id: string;
    name: string;
    provider: string;
}

export interface SelectedModel {
    provider: string;
    modelId: string;
}

// ============================================
// Config Types
// ============================================

export interface LLMConfig {
    openai_api_key?: string;
    bedrock_access_key_id?: string;
    bedrock_secret_access_key?: string;
    bedrock_session_token?: string;
    bedrock_region?: string;
    deepseek_api_key?: string;
    gemini_api_key?: string;
    groq_api_key?: string;
    openrouter_api_key?: string;
    selected_models?: string;
}

// ============================================
// Test Case Types
// ============================================

export type ExpectedOutputType = "string" | "array" | "object";

export interface TestCase {
    id: number;
    promptGroupId: number;
    input: string;
    expectedOutput: string;
    expectedOutputType: ExpectedOutputType;
    createdAt: string;
}

export interface CreateTestCaseRequest {
    input: string;
    /**
     * Only required for schema evaluation prompts.
     * For LLM evaluation prompts, the server will auto-fill safe defaults if omitted.
     */
    expected_output?: string;
    expected_output_type?: ExpectedOutputType;
}

export interface UpdateTestCaseRequest {
    input?: string;
    expected_output?: string;
    expected_output_type?: ExpectedOutputType;
}

// ============================================
// Test Run Types
// ============================================

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface TestJob {
    id: string;
    promptId: number;
    status: JobStatus;
    totalTests: number;
    completedTests: number;
    progress: number;
    results?: TestResults | string;
    error?: string;
    createdAt: string;
}

export interface TestResults {
    overallScore: number;
    evaluationModel?: SelectedModel;
    optimizationModel?: SelectedModel;
    llmResults: LLMResult[];
}

export interface LLMResult {
    llmName: string;
    score: number;
    durationStats?: DurationStats;
    testCaseResults: TestCaseResult[];
}

export interface DurationStats {
    minMs: number;
    maxMs: number;
    avgMs: number;
}

export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    averageScore: number;
    runs: TestRun[];
}

export interface TestRun {
    score: number;
    isCorrect: boolean;
    actualOutput?: string;
    error?: string;
    durationMs?: number;
    expectedFound?: number;
    expectedTotal?: number;
    unexpectedFound?: number;
    reason?: string;
    /**
     * History of optimization rounds when using LLM evaluation with optimization enabled.
     * Round 0 = initial model output + evaluation
     * Round N (N>=1) = each optimization iteration + evaluation
     */
    optimizationHistory?: OptimizationRound[];
}

/**
 * Represents a single round of optimization in LLM evaluation mode.
 */
export interface OptimizationRound {
    roundNumber: number; // 0 = initial, 1+ = optimization iterations
    output: string;
    score: number;
    reason: string;
    durationMs: number; // Time in milliseconds for this round (model output + judge evaluation)
}

export interface StartTestRunRequest {
    promptId: number;
    runsPerTest: number;
    selectedModels: SelectedModel[];
    evaluationModel?: SelectedModel;
    optimizationMaxIterations?: number;
    optimizationThreshold?: number;
    optimizationModel?: SelectedModel;
}

export interface StartTestRunResponse {
    jobId: string;
}

// ============================================
// Import/Export Types
// ============================================

export interface ImportPromptsResult {
    created: number;
    skipped: number;
}

export interface ImportTestCasesResult {
    count: number;
}

export interface ExportPromptData {
    name: string;
    content: string;
    expectedSchema?: string;
    evaluation_mode?: "schema" | "llm";
    evaluation_criteria?: string | null;
}

export interface ExportTestCaseData {
    input: string;
    /**
     * Present for schema evaluation prompts.
     * For LLM evaluation prompts, exports may omit these fields.
     */
    expected_output?: string;
    expected_output_type?: ExpectedOutputType;
}
