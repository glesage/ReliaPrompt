import Joi from "joi";
import { ConfigurationError } from "../errors";

/**
 * Environment variable schema
 */
const envSchema = Joi.object({
    DATABASE_PATH: Joi.string().required().messages({
        "any.required": "DATABASE_PATH environment variable is required",
    }),
    MIGRATIONS_PATH: Joi.string().required().messages({
        "any.required": "MIGRATIONS_PATH environment variable is required",
    }),
    PORT: Joi.number().integer().min(1).max(65535).optional().default(3000).messages({
        "number.base": "PORT must be a valid number",
        "number.integer": "PORT must be an integer",
        "number.min": "PORT must be between 1 and 65535",
        "number.max": "PORT must be between 1 and 65535",
    }),
}).unknown(true); // Allow other environment variables

/**
 * Validated environment variables
 */
export interface ValidatedEnv {
    DATABASE_PATH: string;
    MIGRATIONS_PATH: string;
    PORT: number;
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
        DATABASE_PATH: value.DATABASE_PATH,
        MIGRATIONS_PATH: value.MIGRATIONS_PATH,
        PORT: value.PORT ?? 3000,
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

