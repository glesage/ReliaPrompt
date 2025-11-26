import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const dbPath = path.join(__dirname, "..", "..", "data", "prompts.db");
const migrationsPath = path.join(__dirname, "..", "..", "drizzle");

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
