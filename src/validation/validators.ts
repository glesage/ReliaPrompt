import type { EvaluationMode } from "../../shared/types";
import { EVALUATION_MODES } from "../../shared/types";

/** Model selection shape for API bodies. */
export interface ModelSelectionBody {
    provider: string;
    modelId: string;
}

/** Optional prompt draft when running a suite (overrides suite prompt). */
export interface PromptDraftBody {
    content: string;
    expectedSchema?: string | null;
    evaluationMode?: EvaluationMode;
    evaluationCriteria?: string | null;
}

/** Request body for POST /api/library/test/run */
export interface LibraryRunBody {
    suiteId: string;
    promptDraft?: PromptDraftBody;
    testModels: ModelSelectionBody[];
    evaluationModel?: ModelSelectionBody;
    runsPerTest: number;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function parseModelSelection(item: unknown): ModelSelectionBody {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("each test model must be an object with provider and modelId");
    }
    const obj = item as Record<string, unknown>;
    const provider = obj.provider;
    const modelId = obj.modelId;
    if (!isNonEmptyString(provider)) {
        throw new Error("test model provider is required");
    }
    if (!isNonEmptyString(modelId)) {
        throw new Error("test model modelId is required");
    }
    return { provider: provider.trim(), modelId: modelId.trim() };
}

function parsePromptDraft(value: unknown): PromptDraftBody {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("promptDraft must be an object");
    }
    const obj = value as Record<string, unknown>;
    const content = obj.content;
    if (!isNonEmptyString(content)) {
        throw new Error("promptDraft.content is required and cannot be empty");
    }
    let expectedSchema: string | null | undefined = undefined;
    if (obj.expectedSchema !== undefined) {
        if (obj.expectedSchema !== null && typeof obj.expectedSchema !== "string") {
            throw new Error("promptDraft.expectedSchema must be a string or null");
        }
        expectedSchema =
            obj.expectedSchema === null ? null : String(obj.expectedSchema).trim() || null;
    }
    let evaluationMode: EvaluationMode | undefined = undefined;
    if (obj.evaluationMode !== undefined) {
        const mode = obj.evaluationMode;
        if (typeof mode !== "string" || !EVALUATION_MODES.includes(mode as EvaluationMode)) {
            throw new Error("evaluationMode must be either 'schema' or 'llm'");
        }
        evaluationMode = mode as EvaluationMode;
    }
    let evaluationCriteria: string | null | undefined = undefined;
    if (obj.evaluationCriteria !== undefined) {
        if (obj.evaluationCriteria !== null && typeof obj.evaluationCriteria !== "string") {
            throw new Error("promptDraft.evaluationCriteria must be a string or null");
        }
        evaluationCriteria =
            obj.evaluationCriteria === null ? null : String(obj.evaluationCriteria).trim() || null;
    }
    return {
        content: content.trim(),
        expectedSchema,
        evaluationMode,
        evaluationCriteria,
    };
}

function parseRunsPerTest(value: unknown): number {
    if (value === undefined) return 1;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
        throw new Error("runsPerTest must be an integer between 1 and 100");
    }
    return n;
}

/**
 * Validates and normalizes the request body for POST /api/library/test/run.
 * @throws Error with a clear message on validation failure
 */
export function validateLibraryRunBody(data: unknown): LibraryRunBody {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("request body must be a JSON object");
    }
    const body = data as Record<string, unknown>;

    const suiteIdRaw = body.suiteId;
    if (!isNonEmptyString(suiteIdRaw)) {
        throw new Error("suiteId is required");
    }
    const suiteId = suiteIdRaw.trim();

    const testModelsRaw = body.testModels;
    if (!Array.isArray(testModelsRaw) || testModelsRaw.length < 1) {
        throw new Error("testModels is required and must contain at least one model");
    }
    const testModels = testModelsRaw.map((item, index) => {
        try {
            return parseModelSelection(item);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`testModels[${index}]: ${msg}`);
        }
    });

    let promptDraft: PromptDraftBody | undefined = undefined;
    if (body.promptDraft !== undefined) {
        promptDraft = parsePromptDraft(body.promptDraft);
    }

    let evaluationModel: ModelSelectionBody | undefined = undefined;
    if (body.evaluationModel !== undefined) {
        evaluationModel = parseModelSelection(body.evaluationModel);
    }

    const runsPerTest = parseRunsPerTest(body.runsPerTest);

    return {
        suiteId,
        promptDraft,
        testModels,
        evaluationModel,
        runsPerTest,
    };
}
