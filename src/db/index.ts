import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { DatabaseError } from "../errors";
import { validateEnv } from "../config/env";

// Validate environment variables
const env = validateEnv();
const dbPath = env.DATABASE_PATH;
const migrationsPath = env.MIGRATIONS_PATH;

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let sqlDb: Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function withSave<T>(operation: () => T): T {
    const sqlite = getSqlDb();
    sqlite.run("BEGIN TRANSACTION");
    try {
        const result = operation();
        sqlite.run("COMMIT");
        return result;
    } catch (error) {
        sqlite.run("ROLLBACK");
        throw error;
    }
}

export function initializeDatabase(): void {
    sqlDb = new Database(dbPath);
    sqlDb.run("PRAGMA journal_mode = WAL");
    db = drizzle(sqlDb, { schema });
    migrate(db, { migrationsFolder: migrationsPath });
}

export function getDb() {
    if (!db) {
        throw new DatabaseError("Database not initialized. Call initializeDatabase() first.");
    }
    return db;
}

export function getSqlDb() {
    if (!sqlDb) {
        throw new DatabaseError("Database not initialized. Call initializeDatabase() first.");
    }
    return sqlDb;
}

export { schema };
