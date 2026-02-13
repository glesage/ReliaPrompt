/**
 * Example: code-first prompt and test definitions.
 * Uses Joi + joi-to-json to build expectedSchema strings; the library accepts schema strings only.
 */
import Joi from "joi";
import parse from "joi-to-json";
import { definePrompt, defineTestCase, defineSuite } from "../src/index";

function schemaStringFromJoi(joiSchema: Joi.Schema): string {
    const jsonSchema = parse(joiSchema, "json", {}, { includeSchemaDialect: true });
    return JSON.stringify(jsonSchema);
}

const schemaSummaryPrompt = definePrompt({
    name: "schema-product-summary",
    content: `Extract product information from the user message and return JSON. If there is no product information, return "{}".
Expected format: {"product":"<name>","category":"<category>"}`,
    expectedSchema: schemaStringFromJoi(
        Joi.object({
            product: Joi.string(),
            category: Joi.string(),
        })
    ),
    evaluationMode: "schema",
});

const schemaSummaryTests = [
    defineTestCase({
        input: "The iPhone is a smartphone.",
        expectedOutput: '{"product":"iPhone","category":"smartphone"}',
        expectedOutputType: "object",
    }),
    defineTestCase({
        input: "Lorem ipsum",
        expectedOutput: "{}",
        expectedOutputType: "object",
    }),
];

const llmEntitiesPrompt = definePrompt({
    name: "llm-company-extraction",
    content: `Extract company names from the user message.
## Example
Input: "Microsoft is a technology company founded by Bill Gates."
Output: {"companies":["Microsoft"]}`,
    expectedSchema: schemaStringFromJoi(
        Joi.object({
            companies: Joi.array().items(Joi.string()).required(),
        })
    ),
    evaluationMode: "llm",
    evaluationCriteria: "Identify which companies were correctly extracted and if any were missed",
});

const llmEntitiesTests = [
    defineTestCase({
        input: "Apple and Google are tech companies.",
        expectedOutput: '{"companies":["Apple","Google"]}',
        expectedOutputType: "object",
    }),
    defineTestCase({
        input: "No entities here.",
        expectedOutput: '{"companies":[]}',
        expectedOutputType: "object",
    }),
];

export const suites = [
    defineSuite({ prompt: schemaSummaryPrompt, testCases: schemaSummaryTests }),
    defineSuite({ prompt: llmEntitiesPrompt, testCases: llmEntitiesTests }),
];
