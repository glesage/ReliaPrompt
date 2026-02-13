import { ConfigurationError } from "../errors";

const NODE_ENV_VALID = ["dev", "development", "prod", "test"] as const;
type NodeEnvValid = (typeof NODE_ENV_VALID)[number];

export interface ValidatedEnv {
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

    const raw = process.env.NODE_ENV;
    if (raw === undefined || raw === "") {
        throw new ConfigurationError("NODE_ENV environment variable is required");
    }
    const trimmed = String(raw).trim();
    if (!NODE_ENV_VALID.includes(trimmed as NodeEnvValid)) {
        throw new ConfigurationError(
            `NODE_ENV must be one of: ${NODE_ENV_VALID.join(", ")}. Got: ${trimmed}`
        );
    }
    // Vite expects NODE_ENV=development for dev builds; backend treats dev and development the same

    const portRaw = process.env.PORT;
    const port = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 3000;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigurationError("PORT must be an integer between 1 and 65535");
    }

    validatedEnv = { PORT: port };
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
