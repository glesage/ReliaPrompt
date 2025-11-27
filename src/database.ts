import { eq, desc, inArray, max, and, isNotNull } from "drizzle-orm";
import { getDb, withSave } from "./db";
import {
    config,
    prompts,
    testCases,
    testJobs,
    testResults,
    improvementJobs,
    type Prompt,
    type TestCase,
    type TestJob,
    type TestResult,
    type ImprovementJob,
} from "./db/schema";
import { NotFoundError, ensureExists } from "./errors";
import { DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE } from "./constants";

export { initializeDatabase } from "./db";
export type { Prompt, TestCase, TestJob, TestResult, ImprovementJob };

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

// Legacy function for backward compatibility - fetches versions by name
export function getPromptVersions(name: string): Prompt[] {
    return getDb()
        .select()
        .from(prompts)
        .where(eq(prompts.name, name))
        .orderBy(desc(prompts.version))
        .all();
}

export function getAllPrompts(): Prompt[] {
    return getDb()
        .select()
        .from(prompts)
        .orderBy(prompts.promptGroupId, desc(prompts.version))
        .all();
}

export function createTestCase(promptGroupId: number, input: string, expectedOutput: string) {
    return withSave(() => {
        const createdAt = new Date().toISOString();
        return getDb()
            .insert(testCases)
            .values({
                promptGroupId,
                input,
                expectedOutput,
                createdAt,
            })
            .returning()
            .get();
    });
}

export function getTestCaseById(id: number): TestCase | null {
    return getDb().select().from(testCases).where(eq(testCases.id, id)).get() ?? null;
}

/**
 * Gets a test case by ID or throws NotFoundError if not found.
 * Use this when you expect the test case to exist.
 */
export function getTestCaseByIdOrFail(id: number): TestCase {
    return ensureExists(getTestCaseById(id), "Test case", id);
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

// Legacy function - now just an alias for getTestCasesForPromptGroup
export function getTestCasesForPromptGroupId(groupId: number): TestCase[] {
    return getTestCasesForPromptGroup(groupId);
}

// Legacy function for backward compatibility
export function getTestCasesForPromptName(promptName: string): TestCase[] {
    // Find a prompt with this name and get its group ID
    const prompt = getDb()
        .select()
        .from(prompts)
        .where(eq(prompts.name, promptName))
        .limit(1)
        .get();
    
    if (!prompt) {
        return [];
    }
    
    const groupId = prompt.promptGroupId ?? prompt.id;
    return getTestCasesForPromptGroup(groupId);
}

export function deleteTestCase(id: number): void {
    withSave(() => {
        getDb().delete(testCases).where(eq(testCases.id, id)).run();
    });
}

export function updateTestCase(id: number, input: string, expectedOutput: string) {
    withSave(() => {
        getDb().update(testCases).set({ input, expectedOutput }).where(eq(testCases.id, id)).run();
    });
    return getTestCaseById(id);
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
    unexpectedCount: number,
    error?: string,
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
                unexpectedCount,
                error: error ?? null,
                durationMs: durationMs ?? null,
                createdAt,
            })
            .returning()
            .get();
    });
}

export function getTestResultsForJob(jobId: string): TestResult[] {
    return getDb()
        .select()
        .from(testResults)
        .where(eq(testResults.jobId, jobId))
        .orderBy(testResults.testCaseId, testResults.llmProvider, testResults.runNumber)
        .all();
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
