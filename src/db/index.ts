import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { DatabaseError } from "../errors";
import { validateEnv } from "../config/env";

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

export function initializeDatabase(databasePath?: string, migrationsPath?: string): void {
    // If databasePath is provided, use it (for memory database or custom path)
    // Otherwise, use the environment variable
    const env = validateEnv();
    const dbPath = databasePath ?? env.DATABASE_PATH;
    const migrationsFolder = migrationsPath ?? env.MIGRATIONS_PATH;

    // Only create directory if not using memory database
    if (dbPath !== ":memory:") {
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    sqlDb = new Database(dbPath);
    if (dbPath !== ":memory:") {
        sqlDb.run("PRAGMA journal_mode = WAL");
    }
    db = drizzle(sqlDb, { schema });
    migrate(db, { migrationsFolder });
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
