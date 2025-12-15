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

export const improvementPromptTemplateSchema = Joi.object({
    template: Joi.string().trim().min(1).required().messages({
        "string.empty": "template cannot be empty",
        "any.required": "template is required",
    }),
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
    parentVersionId: Joi.number().integer().positive().optional(),
}).unknown(false);

// Test case schemas
export const createTestCaseSchema = Joi.object({
    input: Joi.string().trim().min(1).required().messages({
        "string.empty": "Input cannot be empty",
        "any.required": "Input is required",
    }),
    expected_output: Joi.string().trim().min(1).required().custom((value, helpers) => {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return helpers.error("any.invalid");
        }
    }).messages({
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
    expected_output: Joi.string().trim().min(1).required().custom((value, helpers) => {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return helpers.error("any.invalid");
        }
    }).messages({
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

// Improvement start schema
export const improveStartSchema = Joi.object({
    promptId: Joi.number().integer().positive().required().messages({
        "number.base": "promptId must be a number",
        "number.integer": "promptId must be an integer",
        "number.positive": "promptId must be positive",
        "any.required": "promptId is required",
    }),
    maxIterations: Joi.number().integer().min(1).max(100).optional().default(5),
    runsPerLlm: Joi.number().integer().min(1).max(100).optional().default(1),
    improvementModel: modelSelectionSchema.optional(),
    benchmarkModels: Joi.array().items(modelSelectionSchema).min(1).optional().messages({
        "array.min": "benchmarkModels must contain at least one model",
    }),
    selectedModels: Joi.array().items(modelSelectionSchema).min(1).optional().messages({
        "array.min": "selectedModels must contain at least one model",
    }),
}).unknown(false).custom((value, helpers) => {
    // Custom validation: either (improvementModel + benchmarkModels) or selectedModels must be provided
    const hasNewApi = value.improvementModel && value.benchmarkModels;
    const hasOldApi = value.selectedModels;
    
    if (!hasNewApi && !hasOldApi) {
        return helpers.error("any.custom", {
            message: "Either (improvementModel and benchmarkModels) or selectedModels must be provided",
        });
    }
    
    if (hasNewApi && (!value.benchmarkModels || value.benchmarkModels.length === 0)) {
        return helpers.error("any.custom", {
            message: "At least one benchmark model is required",
        });
    }
    
    return value;
});

