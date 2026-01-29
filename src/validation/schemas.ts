import Joi from "joi";
import { ParseType } from "../utils/parse";

// Common schemas
export const idParamSchema = Joi.object({
    id: Joi.string().pattern(/^\d+$/).required().messages({
        "string.pattern.base": "id must be a valid integer",
    }),
});

export const jobIdParamSchema = Joi.object({
    jobId: Joi.string().uuid().required().messages({
        "string.guid": "jobId must be a valid UUID",
    }),
});

// Model selection schema
export const modelSelectionSchema = Joi.object({
    provider: Joi.string().required(),
    modelId: Joi.string().required(),
});

// Config schemas
export const configBodySchema = Joi.object({
    openai_api_key: Joi.string().allow("").optional(),
    bedrock_access_key_id: Joi.string().allow("").optional(),
    bedrock_secret_access_key: Joi.string().allow("").optional(),
    bedrock_session_token: Joi.string().allow("").optional(),
    bedrock_region: Joi.string().allow("").optional(),
    deepseek_api_key: Joi.string().allow("").optional(),
    gemini_api_key: Joi.string().allow("").optional(),
    groq_api_key: Joi.string().allow("").optional(),
    openrouter_api_key: Joi.string().allow("").optional(),
    selected_models: Joi.alternatives()
        .try(
            Joi.array().items(modelSelectionSchema),
            Joi.string() // Allow JSON string for backward compatibility
        )
        .optional(),
}).unknown(false);

// Prompt schemas
export const createPromptSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
        "string.empty": "Name cannot be empty",
        "any.required": "Name is required",
    }),
    content: Joi.string().trim().min(1).required().messages({
        "string.empty": "Content cannot be empty",
        "any.required": "Content is required",
    }),
    expectedSchema: Joi.string()
        .trim()
        .allow("")
        .optional()
        .custom((value, helpers) => {
            if (!value || value.trim() === "") {
                return undefined; // Allow empty/undefined
            }
            try {
                JSON.parse(value);
                return value;
            } catch {
                return helpers.error("any.invalid");
            }
        })
        .messages({
            "any.invalid": "Expected schema must be valid JSON",
        }),
    parentVersionId: Joi.number().integer().positive().optional(),
}).unknown(false);

// Test case schemas
export const createTestCaseSchema = Joi.object({
    input: Joi.string().trim().min(1).required().messages({
        "string.empty": "Input cannot be empty",
        "any.required": "Input is required",
    }),
    expected_output: Joi.string()
        .trim()
        .min(1)
        .required()
        .custom((value, helpers) => {
            try {
                JSON.parse(value);
                return value;
            } catch {
                return helpers.error("any.invalid");
            }
        })
        .messages({
            "string.empty": "Expected output cannot be empty",
            "any.required": "Expected output is required",
            "any.invalid": "Expected output must be valid JSON",
        }),
    expected_output_type: Joi.string()
        .valid(...Object.values(ParseType))
        .default(ParseType.ARRAY)
        .messages({
            "any.only": "expected_output_type must be one of: string, array, object",
        }),
}).unknown(false);

export const updateTestCaseSchema = Joi.object({
    input: Joi.string().trim().min(1).required().messages({
        "string.empty": "Input cannot be empty",
        "any.required": "Input is required",
    }),
    expected_output: Joi.string()
        .trim()
        .min(1)
        .required()
        .custom((value, helpers) => {
            try {
                JSON.parse(value);
                return value;
            } catch {
                return helpers.error("any.invalid");
            }
        })
        .messages({
            "string.empty": "Expected output cannot be empty",
            "any.required": "Expected output is required",
            "any.invalid": "Expected output must be valid JSON",
        }),
    expected_output_type: Joi.string()
        .valid(...Object.values(ParseType))
        .required()
        .messages({
            "any.only": "expected_output_type must be one of: string, array, object",
            "any.required": "expected_output_type is required",
        }),
}).unknown(false);

export const importTestCasesSchema = Joi.array().items(createTestCaseSchema).min(0).messages({
    "array.base": "Test cases must be an array",
});

// Import prompts schema
const importPromptItemSchema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
        "string.empty": "Name cannot be empty",
        "any.required": "Name is required",
    }),
    content: Joi.string().trim().min(1).required().messages({
        "string.empty": "Content cannot be empty",
        "any.required": "Content is required",
    }),
    expected_schema: Joi.string()
        .trim()
        .allow("", null)
        .optional()
        .custom((value, helpers) => {
            if (!value || value.trim() === "") {
                return undefined;
            }
            try {
                JSON.parse(value);
                return value;
            } catch {
                return helpers.error("any.invalid");
            }
        })
        .messages({
            "any.invalid": "expected_schema must be valid JSON",
        }),
}).unknown(false);

export const importPromptsSchema = Joi.array().items(importPromptItemSchema).min(1).messages({
    "array.base": "Prompts must be an array",
    "array.min": "At least one prompt is required",
});

// Test run schema
export const testRunSchema = Joi.object({
    promptId: Joi.number().integer().positive().required().messages({
        "number.base": "promptId must be a number",
        "number.integer": "promptId must be an integer",
        "number.positive": "promptId must be positive",
        "any.required": "promptId is required",
    }),
    runsPerTest: Joi.number().integer().min(1).max(100).required().messages({
        "number.base": "runsPerTest must be a number",
        "number.integer": "runsPerTest must be an integer",
        "number.min": "runsPerTest must be at least 1",
        "number.max": "runsPerTest must be at most 100",
        "any.required": "runsPerTest is required",
    }),
    selectedModels: Joi.array().items(modelSelectionSchema).min(1).optional().messages({
        "array.min": "selectedModels must contain at least one model",
    }),
}).unknown(false);

