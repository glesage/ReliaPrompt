import Joi from "joi";
import { ConfigurationError } from "../errors";

const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid("dev", "prod", "test").required().messages({
        "any.required": "NODE_ENV environment variable is required",
    }),
}).unknown(true); // Allow other environment variables
export interface ValidatedEnv {
    PORT: number;
    SCHEMA_PATH: string;
    DATABASE_PATH: string;
    MIGRATIONS_PATH: string;
}

let validatedEnv: ValidatedEnv | null = null;

/**
 * Validates and returns environment variables
 * @throws {ConfigurationError} if validation fails
 */
export function validateEnv(): ValidatedEnv {
    if (validatedEnv) {
        return validatedEnv;
    }

    const { error, value } = envSchema.validate(process.env, {
        abortEarly: false,
        stripUnknown: false,
        convert: true,
    });

    if (error) {
        const errorMessages = error.details.map((detail) => detail.message).join(", ");
        throw new ConfigurationError(`Environment variable validation failed: ${errorMessages}`);
    }

    validatedEnv = {
        PORT: value.PORT ?? 3000,
        SCHEMA_PATH: `./src/db/schema.ts`,
        DATABASE_PATH: `./data/${value.NODE_ENV}.db`,
        MIGRATIONS_PATH: `./drizzle`,
    };

    return validatedEnv;
}

/**
 * Gets validated environment variables (must call validateEnv first)
 */
export function getEnv(): ValidatedEnv {
    if (!validatedEnv) {
        throw new ConfigurationError(
            "Environment variables not validated. Call validateEnv() first."
        );
    }
    return validatedEnv;
}
