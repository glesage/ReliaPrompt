import { describe, test, expect, spyOn, afterEach } from "bun:test";
import {
    definePrompt,
    defineSuite,
    defineTestCase,
    initializeReliaPrompt,
    resetReliaPrompt,
    runPromptTestsFromSuite,
} from "./index";
import { openaiClient } from "./llm-clients";

describe("suite metrics", () => {
    afterEach(() => {
        resetReliaPrompt();
    });

    test("should compute each metric over the model's test case results", async () => {
        const suite = defineSuite({
            prompt: definePrompt({ name: "metrics", content: "Reply." }),
            testCases: [
                defineTestCase({ input: "a", expectedOutput: "output" }),
                defineTestCase({ input: "b", expectedOutput: "output" }),
            ],
            metrics: [
                {
                    name: "Runs",
                    compute: (testCaseResults) =>
                        testCaseResults.flatMap((testCase) => testCase.runs).length,
                },
                {
                    name: "Broken",
                    compute: () => {
                        throw new Error("boom");
                    },
                },
            ],
        });

        initializeReliaPrompt({ providers: { openai_api_key: "test-key" } });
        const completeSpy = spyOn(openaiClient, "complete").mockResolvedValue("output");

        const { results } = await runPromptTestsFromSuite(suite, {
            testModels: [{ provider: "openai", modelId: "test-model" }],
            runsPerTest: 2,
        });
        completeSpy.mockRestore();

        expect(results[0].metrics).toEqual([
            { name: "Runs", value: 4 },
            { name: "Broken", value: "Error: boom" },
        ]);
    });
});
