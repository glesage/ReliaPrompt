import { defineConfig } from "drizzle-kit";
import { validateEnv } from "./src/config/env";

const env = validateEnv();

export default defineConfig({
    dialect: "sqlite",
    schema: env.SCHEMA_PATH,
    out: env.MIGRATIONS_PATH,
    dbCredentials: {
        url: env.DATABASE_PATH,
    },
});
