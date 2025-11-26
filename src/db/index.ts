import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const dbPath = path.join(__dirname, "..", "..", "data", "prompts.db");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

let sqlDb: SqlJsDatabase | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

// Save database to file
export function saveDatabase(): void {
	if (sqlDb) {
		const data = sqlDb.export();
		const buffer = Buffer.from(data);
		fs.writeFileSync(dbPath, buffer);
	}
}

// Initialize database
export async function initializeDatabase(): Promise<void> {
	const SQL = await initSqlJs();

	// Load existing database or create new one
	if (fs.existsSync(dbPath)) {
		const fileBuffer = fs.readFileSync(dbPath);
		sqlDb = new SQL.Database(fileBuffer);
	} else {
		sqlDb = new SQL.Database();
	}

	// Create Drizzle instance
	db = drizzle(sqlDb, { schema });

	// Create tables if they don't exist
	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS config (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);

	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS prompts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			content TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			parent_version_id INTEGER,
			created_at TEXT NOT NULL,
			FOREIGN KEY (parent_version_id) REFERENCES prompts(id)
		)
	`);

	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS test_cases (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			prompt_id INTEGER NOT NULL,
			input TEXT NOT NULL,
			expected_output TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
		)
	`);

	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS test_jobs (
			id TEXT PRIMARY KEY,
			prompt_id INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			total_tests INTEGER NOT NULL DEFAULT 0,
			completed_tests INTEGER NOT NULL DEFAULT 0,
			results TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (prompt_id) REFERENCES prompts(id)
		)
	`);

	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS test_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id TEXT NOT NULL,
			test_case_id INTEGER NOT NULL,
			llm_provider TEXT NOT NULL,
			run_number INTEGER NOT NULL,
			actual_output TEXT,
			is_correct INTEGER NOT NULL DEFAULT 0,
			error TEXT,
			created_at TEXT NOT NULL,
			FOREIGN KEY (job_id) REFERENCES test_jobs(id) ON DELETE CASCADE,
			FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
		)
	`);

	sqlDb.run(`
		CREATE TABLE IF NOT EXISTS improvement_jobs (
			id TEXT PRIMARY KEY,
			prompt_id INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			current_iteration INTEGER NOT NULL DEFAULT 0,
			max_iterations INTEGER NOT NULL,
			best_score REAL,
			best_prompt_content TEXT,
			best_prompt_version_id INTEGER,
			log TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (prompt_id) REFERENCES prompts(id),
			FOREIGN KEY (best_prompt_version_id) REFERENCES prompts(id)
		)
	`);

	saveDatabase();
}

export function getDb() {
	if (!db) {
		throw new Error(
			"Database not initialized. Call initializeDatabase() first."
		);
	}
	return db;
}

export function getSqlDb() {
	if (!sqlDb) {
		throw new Error(
			"Database not initialized. Call initializeDatabase() first."
		);
	}
	return sqlDb;
}

export { schema };

