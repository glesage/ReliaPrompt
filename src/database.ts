import { eq, desc, inArray, max, and, isNotNull } from "drizzle-orm";
import { getDb, withSave } from "./db";
import {
    config,
    prompts,
    testCases,
    testJobs,
    testResults,
    improvementJobs,
    suggestions,
    type Prompt,
    type TestCase,
    type TestJob,
    type TestResult,
    type ImprovementJob,
    type Suggestion,
} from "./db/schema";
import { NotFoundError, ensureExists } from "./errors";
import { DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE } from "./constants";

export { initializeDatabase } from "./db";
export type { Prompt, TestCase, TestJob, TestResult, ImprovementJob, Suggestion };

export function getConfig(key: string): string | null {
    const result = getDb().select().from(config).where(eq(config.key, key)).get();
    return result?.value ?? null;
}

export function setConfig(key: string, value: string): void {
    withSave(() => {
        const db = getDb();
        const existing = db.select().from(config).where(eq(config.key, key)).get();

        if (existing) {
            db.update(config).set({ value }).where(eq(config.key, key)).run();
        } else {
            db.insert(config).values({ key, value }).run();
        }
    });
}

export function getAllConfig(): Record<string, string> {
    const rows = getDb().select().from(config).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
        result[row.key] = row.value;
    }
    return result;
}

export function initializeDefaultConfigs(): void {
    // Initialize improvement prompt template if not set
    const existingTemplate = getConfig("improvement_prompt_template");
    if (!existingTemplate) {
        setConfig("improvement_prompt_template", DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE);
    }
}

export function createPrompt(name: string, content: string, parentVersionId?: number) {
    return withSave(() => {
        const db = getDb();
        let version = 1;
        let promptGroupId: number | null = null;

        if (parentVersionId) {
            const parent = db
                .select({ version: prompts.version, promptGroupId: prompts.promptGroupId })
                .from(prompts)
                .where(eq(prompts.id, parentVersionId))
                .get();
            if (parent) {
                version = parent.version + 1;
                promptGroupId = parent.promptGroupId;
            }
        }

        const createdAt = new Date().toISOString();
        const result = db
            .insert(prompts)
            .values({
                name,
                content,
                version,
                parentVersionId: parentVersionId ?? null,
                promptGroupId,
                createdAt,
            })
            .returning()
            .get();

        // If this is a new prompt (not a version), set promptGroupId to its own ID
        if (!parentVersionId) {
            db.update(prompts)
                .set({ promptGroupId: result.id })
                .where(eq(prompts.id, result.id))
                .run();
            result.promptGroupId = result.id;
        }

        return result;
    });
}

export function getPromptById(id: number): Prompt | null {
    return getDb().select().from(prompts).where(eq(prompts.id, id)).get() ?? null;
}

/**
 * Gets a prompt by ID or throws NotFoundError if not found.
 * Use this when you expect the prompt to exist.
 */
export function getPromptByIdOrFail(id: number): Prompt {
    return ensureExists(getPromptById(id), "Prompt", id);
}

export function deletePrompt(id: number): void {
    withSave(() => {
        const db = getDb();
        const prompt = db.select().from(prompts).where(eq(prompts.id, id)).get();
        if (!prompt) return;

        const groupId = prompt.promptGroupId ?? id;

        // Count how many prompts are in this group
        const totalInGroup = db
            .select()
            .from(prompts)
            .where(eq(prompts.promptGroupId, groupId))
            .all().length;

        // Delete the prompt
        db.delete(prompts).where(eq(prompts.id, id)).run();

        // Only delete test cases if this was the last prompt in the group
        if (totalInGroup <= 1) {
            db.delete(testCases).where(eq(testCases.promptGroupId, groupId)).run();
        }
    });
}

export function deleteAllVersionsOfPrompt(id: number): void {
    withSave(() => {
        const db = getDb();
        // First, get the prompt to find its promptGroupId
        const prompt = db.select().from(prompts).where(eq(prompts.id, id)).get();
        if (!prompt) {
            throw new NotFoundError("Prompt", id);
        }

        const groupId = prompt.promptGroupId ?? id;

        // Delete all test cases for this prompt group
        db.delete(testCases).where(eq(testCases.promptGroupId, groupId)).run();

        // Get all prompt IDs with the same promptGroupId and delete them
        const promptIds = db
            .select({ id: prompts.id })
            .from(prompts)
            .where(eq(prompts.promptGroupId, groupId))
            .all()
            .map((p) => p.id);

        if (promptIds.length > 0) {
            db.delete(prompts).where(inArray(prompts.id, promptIds)).run();
        }
    });
}

export function getLatestPrompts(): Prompt[] {
    const db = getDb();

    // Subquery to get max version per prompt group
    const maxVersions = db
        .select({
            promptGroupId: prompts.promptGroupId,
            maxVersion: max(prompts.version).as("max_version"),
        })
        .from(prompts)
        .where(isNotNull(prompts.promptGroupId))
        .groupBy(prompts.promptGroupId)
        .as("max_versions");

    // Join prompts with the subquery to get only the latest version of each group
    return db
        .select({
            id: prompts.id,
            name: prompts.name,
            content: prompts.content,
            version: prompts.version,
            parentVersionId: prompts.parentVersionId,
            promptGroupId: prompts.promptGroupId,
            createdAt: prompts.createdAt,
        })
        .from(prompts)
        .innerJoin(
            maxVersions,
            and(
                eq(prompts.promptGroupId, maxVersions.promptGroupId),
                eq(prompts.version, maxVersions.maxVersion)
            )
        )
        .orderBy(desc(prompts.createdAt))
        .all();
}

export function getPromptVersionsByGroupId(groupId: number): Prompt[] {
    return getDb()
        .select()
        .from(prompts)
        .where(eq(prompts.promptGroupId, groupId))
        .orderBy(desc(prompts.version))
        .all();
}

export function createTestCase(
    promptGroupId: number,
    input: string,
    expectedOutput: string,
    expectedOutputType: string = "array"
) {
    return withSave(() => {
        const createdAt = new Date().toISOString();
        return getDb()
            .insert(testCases)
            .values({
                promptGroupId,
                input,
                expectedOutput,
                expectedOutputType,
                createdAt,
            })
            .returning()
            .get();
    });
}

export function getTestCaseById(id: number): TestCase | null {
    return getDb().select().from(testCases).where(eq(testCases.id, id)).get() ?? null;
}

export function getTestCasesForPrompt(promptId: number): TestCase[] {
    // Get the prompt to find its promptGroupId
    const prompt = getDb().select().from(prompts).where(eq(prompts.id, promptId)).get();
    if (!prompt) {
        return [];
    }
    const groupId = prompt.promptGroupId ?? promptId;
    return getTestCasesForPromptGroup(groupId);
}

export function getTestCasesForPromptGroup(promptGroupId: number): TestCase[] {
    return getDb()
        .select()
        .from(testCases)
        .where(eq(testCases.promptGroupId, promptGroupId))
        .orderBy(testCases.createdAt)
        .all();
}

export function deleteTestCase(id: number): void {
    withSave(() => {
        getDb().delete(testCases).where(eq(testCases.id, id)).run();
    });
}

export function updateTestCase(
    id: number,
    input: string,
    expectedOutput: string,
    expectedOutputType: string
) {
    withSave(() => {
        getDb()
            .update(testCases)
            .set({ input, expectedOutput, expectedOutputType })
            .where(eq(testCases.id, id))
            .run();
    });
    return getTestCaseById(id);
}

export function deleteAllTestCasesForPromptGroup(promptGroupId: number): void {
    withSave(() => {
        getDb().delete(testCases).where(eq(testCases.promptGroupId, promptGroupId)).run();
    });
}

export function bulkCreateTestCases(
    promptGroupId: number,
    testCasesData: Array<{ input: string; expectedOutput: string; expectedOutputType: string }>
): TestCase[] {
    return withSave(() => {
        const db = getDb();
        const createdAt = new Date().toISOString();
        const created: TestCase[] = [];

        for (const tc of testCasesData) {
            const result = db
                .insert(testCases)
                .values({
                    promptGroupId,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    expectedOutputType: tc.expectedOutputType,
                    createdAt,
                })
                .returning()
                .get();
            created.push(result);
        }

        return created;
    });
}

export function createTestJob(id: string, promptId: number, totalTests: number) {
    return withSave(() => {
        const now = new Date().toISOString();
        return getDb()
            .insert(testJobs)
            .values({
                id,
                promptId,
                status: "pending",
                totalTests,
                completedTests: 0,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get();
    });
}

export function getTestJobById(id: string): TestJob | null {
    return getDb().select().from(testJobs).where(eq(testJobs.id, id)).get() ?? null;
}

/**
 * Gets a test job by ID or throws NotFoundError if not found.
 * Use this when you expect the test job to exist.
 */
export function getTestJobByIdOrFail(id: string): TestJob {
    return ensureExists(getTestJobById(id), "Test job", id);
}

export function getTestJobsForPrompt(promptId: number): TestJob[] {
    return getDb()
        .select()
        .from(testJobs)
        .where(eq(testJobs.promptId, promptId))
        .orderBy(desc(testJobs.createdAt))
        .all();
}

export function getImprovementJobsForPrompt(promptId: number): ImprovementJob[] {
    return getDb()
        .select()
        .from(improvementJobs)
        .where(eq(improvementJobs.promptId, promptId))
        .orderBy(desc(improvementJobs.createdAt))
        .all();
}

export function updateTestJob(id: string, updates: Partial<typeof testJobs.$inferSelect>): void {
    withSave(() => {
        getDb()
            .update(testJobs)
            .set({ ...updates, updatedAt: new Date().toISOString() })
            .where(eq(testJobs.id, id))
            .run();
    });
}

export function createTestResult(
    jobId: string,
    testCaseId: number,
    llmProvider: string,
    runNumber: number,
    actualOutput: string | null,
    isCorrect: boolean,
    score: number,
    expectedFound: number,
    expectedTotal: number,
    unexpectedFound: number,
    durationMs?: number
) {
    return withSave(() => {
        const createdAt = new Date().toISOString();
        return getDb()
            .insert(testResults)
            .values({
                jobId,
                testCaseId,
                llmProvider,
                runNumber,
                actualOutput,
                isCorrect: isCorrect ? 1 : 0,
                score,
                expectedFound,
                expectedTotal,
                unexpectedFound,
                durationMs: durationMs ?? null,
                createdAt,
            })
            .returning()
            .get();
    });
}

export function createImprovementJob(id: string, promptId: number, maxIterations: number) {
    return withSave(() => {
        const now = new Date().toISOString();
        return getDb()
            .insert(improvementJobs)
            .values({
                id,
                promptId,
                status: "pending",
                currentIteration: 0,
                maxIterations,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get();
    });
}

export function getImprovementJobById(id: string): ImprovementJob | null {
    return getDb().select().from(improvementJobs).where(eq(improvementJobs.id, id)).get() ?? null;
}

/**
 * Gets an improvement job by ID or throws NotFoundError if not found.
 * Use this when you expect the improvement job to exist.
 */
export function getImprovementJobByIdOrFail(id: string): ImprovementJob {
    return ensureExists(getImprovementJobById(id), "Improvement job", id);
}

export function updateImprovementJob(
    id: string,
    updates: Partial<typeof improvementJobs.$inferSelect>
): void {
    withSave(() => {
        getDb()
            .update(improvementJobs)
            .set({ ...updates, updatedAt: new Date().toISOString() })
            .where(eq(improvementJobs.id, id))
            .run();
    });
}

export function appendImprovementLog(id: string, message: string): void {
    const job = getImprovementJobById(id);
    const currentLog = job?.log ?? "";
    const timestamp = new Date().toISOString();
    const newLog = currentLog + `[${timestamp}] ${message}\n`;
    updateImprovementJob(id, { log: newLog });
}

// ============================================================================
// Suggestions CRUD
// ============================================================================

export function createSuggestion(
    improvementJobId: string,
    iteration: number,
    content: string,
    rationale?: string
): Suggestion {
    return withSave(() => {
        const createdAt = new Date().toISOString();
        return getDb()
            .insert(suggestions)
            .values({
                improvementJobId,
                iteration,
                content,
                rationale: rationale ?? null,
                status: "pending",
                createdAt,
            })
            .returning()
            .get();
    });
}

export function createSuggestions(
    improvementJobId: string,
    iteration: number,
    suggestionData: Array<{ content: string; rationale?: string }>
): Suggestion[] {
    return withSave(() => {
        const db = getDb();
        const createdAt = new Date().toISOString();
        const created: Suggestion[] = [];

        for (const s of suggestionData) {
            const result = db
                .insert(suggestions)
                .values({
                    improvementJobId,
                    iteration,
                    content: s.content,
                    rationale: s.rationale ?? null,
                    status: "pending",
                    createdAt,
                })
                .returning()
                .get();
            created.push(result);
        }

        return created;
    });
}

export function getSuggestionById(id: number): Suggestion | null {
    return getDb().select().from(suggestions).where(eq(suggestions.id, id)).get() ?? null;
}

export function getSuggestionsForJob(improvementJobId: string): Suggestion[] {
    return getDb()
        .select()
        .from(suggestions)
        .where(eq(suggestions.improvementJobId, improvementJobId))
        .orderBy(suggestions.iteration, suggestions.id)
        .all();
}

export function getSuggestionsForJobByStatus(
    improvementJobId: string,
    status: "pending" | "applied" | "undone" | "rejected"
): Suggestion[] {
    return getDb()
        .select()
        .from(suggestions)
        .where(
            and(eq(suggestions.improvementJobId, improvementJobId), eq(suggestions.status, status))
        )
        .orderBy(suggestions.iteration, suggestions.id)
        .all();
}

export function updateSuggestionStatus(
    id: number,
    status: "pending" | "applied" | "undone" | "rejected"
): void {
    withSave(() => {
        const now = new Date().toISOString();
        const updates: Partial<Suggestion> = { status };

        if (status === "applied") {
            updates.appliedAt = now;
        } else if (status === "undone") {
            updates.undoneAt = now;
        }

        getDb().update(suggestions).set(updates).where(eq(suggestions.id, id)).run();
    });
}

export function markSuggestionsAsApplied(suggestionIds: number[]): void {
    if (suggestionIds.length === 0) return;
    withSave(() => {
        const now = new Date().toISOString();
        getDb()
            .update(suggestions)
            .set({ status: "applied", appliedAt: now })
            .where(inArray(suggestions.id, suggestionIds))
            .run();
    });
}

export function markSuggestionsAsUndone(suggestionIds: number[]): void {
    if (suggestionIds.length === 0) return;
    withSave(() => {
        const now = new Date().toISOString();
        getDb()
            .update(suggestions)
            .set({ status: "undone", undoneAt: now })
            .where(inArray(suggestions.id, suggestionIds))
            .run();
    });
}

/**
 * Clear all data from the database (useful for testing)
 * Deletes all rows from all tables in the correct order to respect foreign key constraints
 */
export function clearAllData(): void {
    withSave(() => {
        const db = getDb();
        // Delete in order to respect foreign key constraints
        db.delete(testResults).run();
        db.delete(testJobs).run();
        db.delete(suggestions).run();
        db.delete(improvementJobs).run();
        db.delete(testCases).run();
        db.delete(prompts).run();
        db.delete(config).run();
    });
}
