import { eq, desc, inArray, max, and, isNotNull } from "drizzle-orm";
import { getDb, withSave } from "./db";
import {
    config,
    prompts,
    testCases,
    testJobs,
    testResults,
    type Prompt,
    type TestCase,
    type TestJob,
    type TestResult,
} from "./db/schema";
import { NotFoundError, ensureExists } from "./errors";

export { initializeDatabase } from "./db";
export type { Prompt, TestCase, TestJob, TestResult };

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
    // Reserved for future default config initialization
}

export function createPrompt(
    name: string,
    content: string,
    parentVersionId?: number,
    expectedSchema?: string
) {
    return withSave(() => {
        const db = getDb();
        let version = 1;
        let promptGroupId: number | null = null;
        let schemaToUse = expectedSchema ?? null;

        if (parentVersionId) {
            const parent = db
                .select({
                    version: prompts.version,
                    promptGroupId: prompts.promptGroupId,
                    expectedSchema: prompts.expectedSchema,
                })
                .from(prompts)
                .where(eq(prompts.id, parentVersionId))
                .get();
            if (parent) {
                version = parent.version + 1;
                promptGroupId = parent.promptGroupId;
                // Inherit schema from parent if not explicitly provided
                if (!expectedSchema && parent.expectedSchema) {
                    schemaToUse = parent.expectedSchema;
                }
            }
        }

        const createdAt = new Date().toISOString();
        const result = db
            .insert(prompts)
            .values({
                name,
                content,
                expectedSchema: schemaToUse,
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
            expectedSchema: prompts.expectedSchema,
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
        db.delete(testCases).run();
        db.delete(prompts).run();
        db.delete(config).run();
    });
}
