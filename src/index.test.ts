/**
 * Library API tests: initialization, runPromptTests validation.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
    initializeReliaPrompt,
    resetReliaPrompt,
    runPromptTests,
    runPromptTestsFromSuite,
    definePrompt,
    defineTestCase,
    defineSuite,
} from "./index";
import { ConfigurationError } from "./errors";

describe("relia-prompt library API", () => {
    beforeEach(() => {
        resetReliaPrompt();
    });

    afterEach(() => {
        resetReliaPrompt();
    });

    test("initializeReliaPrompt sets overlay", () => {
        initializeReliaPrompt({
            providers: { openai_api_key: "test-key" },
        });
        // No throw; overlay is set (verified by runPromptTests requiring models)
        resetReliaPrompt();
    });

    test("runPromptTests throws when testModels is empty", async () => {
        initializeReliaPrompt({ providers: { openai_api_key: "x" } });
        await expect(
            runPromptTests(
                "You are a helper.",
                [{ input: "Hi", expectedOutput: "[]", expectedOutputType: "array" }],
                { testModels: [] }
            )
        ).rejects.toThrow(ConfigurationError);
    });

    test("runPromptTests throws when evaluationMode is llm and evaluationModel is missing", async () => {
        initializeReliaPrompt({ providers: { openai_api_key: "x" } });
        await expect(
            runPromptTests(
                {
                    content: "Help.",
                    evaluationMode: "llm",
                    evaluationCriteria: "Be helpful.",
                },
                [{ input: "Hi", expectedOutput: "[]", expectedOutputType: "array" }],
                { testModels: [{ provider: "openai", modelId: "gpt-5.2" }] }
            )
        ).rejects.toThrow(ConfigurationError);
    });

    test("definePrompt and defineSuite produce valid suite", () => {
        const prompt = definePrompt({ name: "test-prompt", content: "Hello" });
        expect(prompt.id).toBe("test-prompt");
        expect(prompt.content).toBe("Hello");
        const tc = defineTestCase({
            input: "x",
            expectedOutput: "[]",
            expectedOutputType: "array",
        });
        const suite = defineSuite({ prompt, testCases: [tc] });
        expect(suite.id).toBe("test-prompt");
        expect(suite.testCases).toHaveLength(1);
        expect(suite.testCases[0].input).toBe("x");
    });

    test("defineTestCase defaults expectedOutputType to string", () => {
        const tc = defineTestCase({ input: "name", expectedOutput: "Alice" });
        expect(tc.expectedOutputType).toBe("string");
    });
});
