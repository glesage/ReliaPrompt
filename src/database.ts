import { eq, desc, and, inArray, max, sql } from "drizzle-orm";
import {
	getDb,
	getSqlDb,
	saveDatabase,
	initializeDatabase as initDb,
	schema,
} from "./db";
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

// Re-export initialization
export { initializeDatabase } from "./db";

// Re-export types for backwards compatibility
export type { Prompt, TestCase, TestJob, TestResult, ImprovementJob };

// ============== CONFIG OPERATIONS ==============

export function getConfig(key: string): string | null {
	const result = getDb().select().from(config).where(eq(config.key, key)).get();
	return result?.value ?? null;
}

export function setConfig(key: string, value: string): void {
	const db = getDb();
	const existing = db.select().from(config).where(eq(config.key, key)).get();

	if (existing) {
		db.update(config).set({ value }).where(eq(config.key, key)).run();
	} else {
		db.insert(config).values({ key, value }).run();
	}
	saveDatabase();
}

export function getAllConfig(): Record<string, string> {
	const rows = getDb().select().from(config).all();
	const result: Record<string, string> = {};
	for (const row of rows) {
		result[row.key] = row.value;
	}
	return result;
}

// ============== PROMPT OPERATIONS ==============

export function createPrompt(
	name: string,
	content: string,
	parentVersionId?: number
): Prompt {
	const db = getDb();
	let version = 1;

	if (parentVersionId) {
		const parent = db
			.select({ version: prompts.version })
			.from(prompts)
			.where(eq(prompts.id, parentVersionId))
			.get();
		if (parent) {
			version = parent.version + 1;
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
			createdAt,
		})
		.returning()
		.get();

	saveDatabase();
	return result;
}

export function getPromptById(id: number): Prompt | null {
	return getDb().select().from(prompts).where(eq(prompts.id, id)).get() ?? null;
}

export function deletePrompt(id: number): void {
	const db = getDb();
	// Delete all test cases for this prompt first
	db.delete(testCases).where(eq(testCases.promptId, id)).run();
	// Delete the prompt
	db.delete(prompts).where(eq(prompts.id, id)).run();
	saveDatabase();
}

export function deletePromptByName(name: string): void {
	const db = getDb();
	// Get all prompt IDs with this name
	const promptIds = db
		.select({ id: prompts.id })
		.from(prompts)
		.where(eq(prompts.name, name))
		.all()
		.map((p) => p.id);

	if (promptIds.length > 0) {
		// Delete all test cases for these prompts
		db.delete(testCases).where(inArray(testCases.promptId, promptIds)).run();
		// Delete all versions of the prompt
		db.delete(prompts).where(eq(prompts.name, name)).run();
	}
	saveDatabase();
}

export function getLatestPrompts(): Prompt[] {
	// Use raw SQL for the complex subquery since Drizzle doesn't support this well
	const sqlDb = getSqlDb();
	const stmt = sqlDb.prepare(`
		SELECT p1.* FROM prompts p1
		INNER JOIN (
			SELECT name, MAX(version) as max_version
			FROM prompts
			GROUP BY name
		) p2 ON p1.name = p2.name AND p1.version = p2.max_version
		ORDER BY p1.created_at DESC
	`);

	const results: Prompt[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject() as Prompt;
		results.push(row);
	}
	stmt.free();
	return results;
}

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
		.orderBy(prompts.name, desc(prompts.version))
		.all();
}

// ============== TEST CASE OPERATIONS ==============

export function createTestCase(
	promptId: number,
	input: string,
	expectedOutput: string
): TestCase {
	const createdAt = new Date().toISOString();
	const result = getDb()
		.insert(testCases)
		.values({
			promptId,
			input,
			expectedOutput,
			createdAt,
		})
		.returning()
		.get();

	saveDatabase();
	return result;
}

export function getTestCaseById(id: number): TestCase | null {
	return (
		getDb().select().from(testCases).where(eq(testCases.id, id)).get() ?? null
	);
}

export function getTestCasesForPrompt(promptId: number): TestCase[] {
	return getDb()
		.select()
		.from(testCases)
		.where(eq(testCases.promptId, promptId))
		.orderBy(testCases.createdAt)
		.all();
}

export function getTestCasesForPromptName(promptName: string): TestCase[] {
	// Use raw SQL for the join query
	const sqlDb = getSqlDb();
	const stmt = sqlDb.prepare(`
		SELECT tc.* FROM test_cases tc
		INNER JOIN prompts p ON tc.prompt_id = p.id
		WHERE p.name = ?
		ORDER BY tc.created_at
	`);
	stmt.bind([promptName]);

	const results: TestCase[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject() as TestCase;
		results.push(row);
	}
	stmt.free();
	return results;
}

export function deleteTestCase(id: number): void {
	getDb().delete(testCases).where(eq(testCases.id, id)).run();
	saveDatabase();
}

export function updateTestCase(
	id: number,
	input: string,
	expectedOutput: string
): TestCase | null {
	getDb()
		.update(testCases)
		.set({ input, expectedOutput })
		.where(eq(testCases.id, id))
		.run();
	saveDatabase();
	return getTestCaseById(id);
}

// ============== TEST JOB OPERATIONS ==============

export function createTestJob(
	id: string,
	promptId: number,
	totalTests: number
): TestJob {
	const now = new Date().toISOString();
	const result = getDb()
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

	saveDatabase();
	return result;
}

export function getTestJobById(id: string): TestJob | null {
	return (
		getDb().select().from(testJobs).where(eq(testJobs.id, id)).get() ?? null
	);
}

export function updateTestJob(id: string, updates: Partial<TestJob>): void {
	const updateData: Partial<TestJob> = {
		...updates,
		updatedAt: new Date().toISOString(),
	};

	getDb().update(testJobs).set(updateData).where(eq(testJobs.id, id)).run();
	saveDatabase();
}

// ============== TEST RESULT OPERATIONS ==============

export function createTestResult(
	jobId: string,
	testCaseId: number,
	llmProvider: string,
	runNumber: number,
	actualOutput: string | null,
	isCorrect: boolean,
	error?: string
): TestResult {
	const createdAt = new Date().toISOString();
	const result = getDb()
		.insert(testResults)
		.values({
			jobId,
			testCaseId,
			llmProvider,
			runNumber,
			actualOutput,
			isCorrect: isCorrect ? 1 : 0,
			error: error ?? null,
			createdAt,
		})
		.returning()
		.get();

	saveDatabase();
	return result;
}

export function getTestResultsForJob(jobId: string): TestResult[] {
	return getDb()
		.select()
		.from(testResults)
		.where(eq(testResults.jobId, jobId))
		.orderBy(testResults.testCaseId, testResults.llmProvider, testResults.runNumber)
		.all();
}

// ============== IMPROVEMENT JOB OPERATIONS ==============

export function createImprovementJob(
	id: string,
	promptId: number,
	maxIterations: number
): ImprovementJob {
	const now = new Date().toISOString();
	const result = getDb()
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

	saveDatabase();
	return result;
}

export function getImprovementJobById(id: string): ImprovementJob | null {
	return (
		getDb()
			.select()
			.from(improvementJobs)
			.where(eq(improvementJobs.id, id))
			.get() ?? null
	);
}

export function updateImprovementJob(
	id: string,
	updates: Partial<ImprovementJob>
): void {
	const updateData: Partial<ImprovementJob> = {
		...updates,
		updatedAt: new Date().toISOString(),
	};

	getDb()
		.update(improvementJobs)
		.set(updateData)
		.where(eq(improvementJobs.id, id))
		.run();
	saveDatabase();
}

export function appendImprovementLog(id: string, message: string): void {
	const job = getImprovementJobById(id);
	const currentLog = job?.log ?? "";
	const timestamp = new Date().toISOString();
	const newLog = currentLog + `[${timestamp}] ${message}\n`;
	updateImprovementJob(id, { log: newLog });
}
