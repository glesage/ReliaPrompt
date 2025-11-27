import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

// Required environment variables
if (!process.env.DATABASE_PATH) {
    throw new Error("DATABASE_PATH environment variable is required");
}
if (!process.env.MIGRATIONS_PATH) {
    throw new Error("MIGRATIONS_PATH environment variable is required");
}

const dbPath = process.env.DATABASE_PATH;
const migrationsPath = process.env.MIGRATIONS_PATH;

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let sqlDb: Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function withSave<T>(operation: () => T): T {
    return operation();
}

export function initializeDatabase(): void {
    sqlDb = new Database(dbPath);
    sqlDb.run("PRAGMA journal_mode = WAL");
    db = drizzle(sqlDb, { schema });
    migrate(db, { migrationsFolder: migrationsPath });
}

export function getDb() {
    if (!db) {
        throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return db;
}

export function getSqlDb() {
    if (!sqlDb) {
        throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return sqlDb;
}

export { schema };
