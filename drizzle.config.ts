import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_PATH) {
    throw new Error("DATABASE_PATH environment variable is required");
}
if (!process.env.MIGRATIONS_PATH) {
    throw new Error("MIGRATIONS_PATH environment variable is required");
}

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: process.env.MIGRATIONS_PATH,
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.DATABASE_PATH,
    },
});
