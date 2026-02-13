/**
 * Example: run the prompt definitions (suites from reliaprompt.definitions.ts).
 * Each suite is run via runPromptTestsFromSuite. Requires OPENAI_API_KEY for real LLM runs.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { initializeReliaPrompt, resetReliaPrompt, runPromptTestsFromSuite } from "../src/index";
import { suites } from "./reliaprompt.definitions";

const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

describe("prompt definitions", () => {
    beforeAll(() => {
        initializeReliaPrompt({
            providers: {
                openai_api_key: process.env.OPENAI_API_KEY ?? "",
            },
        });
    });

    afterAll(() => {
        resetReliaPrompt();
    });

    for (const suite of suites) {
        const isLlm = (suite.prompt.evaluationMode ?? "schema") === "llm";
        test(`${suite.id}`, async () => {
            if (!hasApiKey) {
                console.warn("Skipping: OPENAI_API_KEY not set");
                return;
            }
            const result = await runPromptTestsFromSuite(suite, {
                testModels: [{ provider: "OpenAI", modelId: "gpt-5.2" }],
                evaluationModel: isLlm ? { provider: "OpenAI", modelId: "gpt-5.2" } : undefined,
                runsPerTest: 1,
            });
            expect(typeof result.score).toBe("number");
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
            expect(Array.isArray(result.results)).toBe(true);
        });
    }
});
