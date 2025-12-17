import { test, expect } from "@playwright/test";
import { e2eServer, type ServerInstance } from "./helpers/e2eServer";
import {
    configureDeepseek,
    getAvailableModels,
    createPrompt,
    createTestCase,
    startTestRun,
    waitForTestRun,
    clearDatabase,
    type ModelSelection,
} from "./helpers/api";

test.describe("Test Run E2E", () => {
    let server: ServerInstance | null = null;
    let deepseekModel: ModelSelection | null = null;

    test.beforeEach(async () => {
        server = await e2eServer();
    });

    test.afterEach(async () => {
        if (server) {
            try {
                await clearDatabase(server.baseUrl);
            } catch (error) {
                console.error("Failed to clear database:", error);
            }
        }
        if (server) {
            await server.close();
            server = null;
        }
    });

    test("should run a test with Deepseek", async ({ page }) => {
        if (!server) throw new Error("Server not started");

        await configureDeepseek(server.baseUrl);

        const models = await getAvailableModels(server.baseUrl);
        const deepseekModelInfo = models.find((m) => m.provider === "Deepseek");
        expect(deepseekModelInfo).toBeDefined();
        if (!deepseekModelInfo) {
            throw new Error("Deepseek model not found");
        }
        deepseekModel = {
            provider: deepseekModelInfo.provider,
            modelId: deepseekModelInfo.id,
        };

        await page.goto(`${server.baseUrl}/test-runs.html`);

        const prompt = await createPrompt(
            server.baseUrl,
            "Text Summarization E2E Test",
            `You are a helpful assistant that summarizes text into key points. 
Given a piece of text, extract the main points and return them as a JSON array of strings.
Each string should be a concise summary point (one sentence or short phrase).

IMPORTANT: Return ONLY a valid JSON array. Do not include any markdown, code blocks, explanations, or other text.
Example format: ["point 1", "point 2", "point 3"]`
        );

        const testCase = await createTestCase(
            server.baseUrl,
            prompt.id,
            "Summarize this article: Artificial intelligence is transforming healthcare by enabling faster diagnosis, personalized treatment plans, and drug discovery. AI systems can analyze medical images, predict patient outcomes, and assist doctors in making better decisions.",
            '["AI enables faster medical diagnosis", "AI enables personalized treatment plans", "AI assists in drug discovery", "AI analyzes medical images", "AI predicts patient outcomes", "AI assists doctors in decision-making"]',
            "array"
        );

        await page.goto(`${server.baseUrl}/test-runs.html`);

        await page.waitForSelector("#sidebar-prompts", { state: "visible" });

        await page.waitForFunction(
            () => {
                const sidebar = document.querySelector("#sidebar-prompts");
                return sidebar && !sidebar.textContent?.includes("Loading");
            },
            { timeout: 10000 }
        );

        const promptSelector = page
            .locator("#sidebar-prompts")
            .getByText("Text Summarization E2E Test")
            .first();
        await promptSelector.waitFor({ state: "visible", timeout: 10000 });
        await promptSelector.click();

        await page.waitForSelector("#test-section", { state: "visible" });

        await page.waitForSelector("#test-models-selection", { state: "visible" });

        const modelCheckbox = page.locator(
            `input[type="checkbox"][data-provider="Deepseek"][data-model-id="${deepseekModel.modelId}"]`
        );
        await modelCheckbox.waitFor({ state: "visible", timeout: 10000 });
        await modelCheckbox.check();

        const runsPerTestInput = page.locator("#runs-per-test");
        const currentValue = await runsPerTestInput.inputValue();
        if (currentValue !== "1") {
            await runsPerTestInput.fill("1");
        }

        await page.click("#run-btn");

        await page.waitForSelector("#progress-section", { state: "visible" });

        const testRun = await startTestRun(
            server.baseUrl,
            prompt.id,
            [deepseekModel],
            1 // runsPerTest: 1
        );

        const results = await waitForTestRun(server.baseUrl, testRun.jobId, 120000);

        await page.waitForSelector("#results-section", { state: "visible", timeout: 120000 });

        expect(results).toBeDefined();
        expect(results.llmResults).toBeDefined();
        expect(results.llmResults.length).toBeGreaterThan(0);

        expect(results.overallScore).toBeGreaterThanOrEqual(0);
        expect(results.overallScore).toBeLessThanOrEqual(1);

        const deepseekResult = results.llmResults.find((r) => r.llmName.includes("Deepseek"));
        expect(deepseekResult).toBeDefined();
        if (deepseekResult) {
            expect(deepseekResult.testCaseResults).toBeDefined();
            expect(deepseekResult.testCaseResults.length).toBe(1);

            const testCaseResult = deepseekResult.testCaseResults[0];
            expect(testCaseResult.input).toBe(testCase.input);
            expect(testCaseResult.expectedOutput).toBe(testCase.expectedOutput);

            expect(testCaseResult.runs).toBeDefined();
            expect(testCaseResult.runs.length).toBe(1);

            const runResult = testCaseResult.runs[0];
            expect(runResult.actualOutput !== null || runResult.error !== undefined).toBe(true);

            if (runResult.error) {
                throw new Error(`Test run had error: ${runResult.error}`);
            } else {
                expect(runResult.actualOutput).toBeTruthy();
            }

            expect(runResult.score).toBeGreaterThanOrEqual(0);
            expect(runResult.score).toBeLessThanOrEqual(1);

            expect(runResult.expectedFound).toBeGreaterThanOrEqual(0);
            expect(runResult.expectedTotal).toBeGreaterThanOrEqual(0);
            expect(runResult.unexpectedFound).toBeGreaterThanOrEqual(0);

            if (!runResult.error) {
                expect(runResult.actualOutput).toBeTruthy();
                if (runResult.expectedTotal > 0) {
                    expect(testCaseResult.averageScore).toBeGreaterThanOrEqual(0);
                    expect(testCaseResult.averageScore).toBeLessThanOrEqual(1);
                }
            } else {
                expect(runResult.error).toBeTruthy();
            }

            expect(testCaseResult.averageScore).toBeGreaterThanOrEqual(0);
            expect(testCaseResult.averageScore).toBeLessThanOrEqual(1);
        }

        const resultsSection = page.locator("#results-section");
        await expect(resultsSection).toBeVisible();

        const overallScoreBadge = page.locator("#overall-score-badge");
        await expect(overallScoreBadge).toBeVisible();
        const scoreText = await overallScoreBadge.textContent();
        expect(scoreText).toMatch(/\d+%/);

        const llmResults = page.locator("#llm-results");
        await expect(llmResults).toBeVisible();

        const uiScoreMatch = scoreText?.match(/(\d+)%/);
        if (uiScoreMatch) {
            const uiScorePercent = parseInt(uiScoreMatch[1], 10);
            const apiScorePercent = Math.round(results.overallScore * 100);
            expect(Math.abs(uiScorePercent - apiScorePercent)).toBeLessThanOrEqual(1);
        }
    });
});
