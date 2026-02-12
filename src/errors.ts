/**
 * Base class for all application errors.
 * Provides consistent error structure and message handling.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string | number) {
        const message = identifier
            ? `${resource} ${identifier} not found`
            : `${resource} not found`;
        super(message, 404);
    }
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

/**
 * Error thrown when required configuration is missing.
 */
export class ConfigurationError extends AppError {
    constructor(message: string) {
        super(message, 503);
    }
}

/**
 * Error thrown when an LLM API call fails.
 */
export class LLMError extends AppError {
    public readonly provider: string;

    constructor(provider: string, message: string) {
        super(`[${provider}] ${message}`, 502);
        this.provider = provider;
    }
}

/**
 * Safely extracts an error message from an unknown error type.
 * Use this instead of `(error as Error).message`.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "An unknown error occurred";
}

/**
 * Determines the appropriate HTTP status code for an error.
 */
export function getErrorStatusCode(error: unknown): number {
    if (error instanceof AppError) {
        return error.statusCode;
    }
    return 500;
}

/**
 * Asserts that a value is not null or undefined.
 * Throws NotFoundError if the value is nullish.
 * This is a type-narrowing assertion function.
 *
 * @example
 * const prompt = getPromptById(id);
 * requireEntity(prompt, "Prompt", id);
 * // prompt is now typed as Prompt (not Prompt | null)
 */
export function requireEntity<T>(
    value: T | null | undefined,
    resourceName: string,
    identifier?: string | number
): asserts value is T {
    if (value === null || value === undefined) {
        throw new NotFoundError(resourceName, identifier);
    }
}

/**
 * Returns the value if not null/undefined, or throws NotFoundError.
 * Use when you need the value inline rather than as an assertion.
 *
 * @example
 * const prompt = ensureExists(getPromptById(id), "Prompt", id);
 * // prompt is typed as Prompt
 */
export function ensureExists<T>(
    value: T | null | undefined,
    resourceName: string,
    identifier?: string | number
): T {
    if (value === null || value === undefined) {
        throw new NotFoundError(resourceName, identifier);
    }
    return value;
}
