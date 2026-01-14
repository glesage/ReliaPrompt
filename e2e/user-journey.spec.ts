import { test, expect } from "@playwright/test";
import { e2eServer, type ServerInstance } from "./e2eServer";

test.describe("User Journey E2E", () => {
    let server: ServerInstance | null = null;

    // Test data
    const PROMPT_NAME = "E2E User Journey Test Prompt";
    const PROMPT_CONTENT = `You are a helpful assistant that extracts entities from text. 
Return a JSON array with objects containing 'type' and 'name' fields.
IMPORTANT: Return ONLY valid JSON array. No markdown, no explanations.
Example: [{"type": "company", "name": "Apple"}]`;
    const TEST_CASE_INPUT =
        "Extract entities from: Microsoft is a technology company founded by Bill Gates";
    const TEST_CASE_EXPECTED =
        '[{"type": "company", "name": "Microsoft"}, {"type": "person", "name": "Bill Gates"}]';

    test.beforeEach(async () => {
        server = await e2eServer();
    });

    test.afterEach(async () => {
        if (server) {
            try {
                const response = await fetch(`${server.baseUrl}/api/test/clear`, {
                    method: "DELETE",
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        `Failed to clear database: ${error.error || response.statusText}`
                    );
                }
            } catch (error) {
                console.error("Failed to clear database:", error);
            }
        }
        if (server) {
            await server.close();
            server = null;
        }
    });

    test("complete user journey: configure LLMs, create prompt, test case, run tests, and auto-improve", async ({
        page,
    }) => {
        if (!server) throw new Error("Server not started");

        // ============================================
        // Step 1: Open the website
        // ============================================
        await page.goto(`${server.baseUrl}/test-cases`);
        await page.waitForSelector(".app-layout", { state: "visible" });

        // ============================================
        // Step 2: Configure LLMs via UI
        // ============================================
        // Click the "LLMs" button to open config modal
        await page.click("#setup-btn");
        await page.waitForSelector("#config-modal.active", { state: "visible" });

        // Fill in Deepseek API key
        const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "test";
        await page.fill("#deepseek_api_key", deepseekApiKey);

        // Submit the form
        await page.click('#config-form button[type="submit"]');

        // Wait for success message and configured badge
        await page.waitForSelector("#deepseek-status.configured", {
            state: "visible",
            timeout: 10000,
        });

        // Close the modal
        await page.click("#config-close-btn");
        await page.waitForSelector("#config-modal.active", { state: "hidden" });

        // ============================================
        // Step 3: Create a Prompt via UI
        // ============================================
        // Click "New Prompt" button
        await page.click("#new-prompt-btn");
        await page.waitForSelector("#new-prompt-modal.active", { state: "visible" });

        // Fill in prompt details
        await page.fill("#new-prompt-name", PROMPT_NAME);
        await page.fill("#new-prompt-content", PROMPT_CONTENT);

        // Submit the form
        await page.click('#new-prompt-form button[type="submit"]');

        // Wait for modal to close
        await page.waitForSelector("#new-prompt-modal.active", { state: "hidden" });

        // Verify the prompt appears in the sidebar
        await page.waitForSelector("#sidebar-prompts", { state: "visible" });
        await page.waitForFunction(() => {
            const sidebar = document.querySelector("#sidebar-prompts");
            return sidebar && !sidebar.textContent?.includes("Loading");
        });

        const promptHeader = page
            .locator("#sidebar-prompts .sidebar-group-header")
            .filter({ hasText: PROMPT_NAME })
            .first();
        await promptHeader.waitFor({ state: "visible" });

        // Click to expand/select the prompt (auto-selects latest version)
        await promptHeader.click();

        // Verify the test case section is now visible
        await page.waitForSelector("#test-case-section", { state: "visible" });

        // ============================================
        // Step 4: Create a Test Case via UI
        // ============================================
        // Click "New test case" button (inline split editor)
        await page.click("#add-test-case-btn");
        await page.waitForSelector("#testcase-editor", { state: "visible" });

        // Fill in test case details
        await page.fill("#tc-input", TEST_CASE_INPUT);
        await page.fill("#tc-expected-output", TEST_CASE_EXPECTED);
        await page.selectOption("#tc-expected-output-type", "array");

        // Save
        await page.click("#testcase-save-btn");

        // Verify the test case appears in the list
        await page.waitForSelector("#test-cases-list .tc-list-item", { state: "visible" });
        const testCaseItem = page.locator("#test-cases-list .tc-list-item");
        await expect(testCaseItem).toBeVisible();

        // Verify test case content is displayed
        await expect(page.locator("#test-cases-list")).toContainText("Microsoft");

        // ============================================
        // Step 5: Navigate to Test Runs and Execute
        // ============================================
        await page.goto(`${server.baseUrl}/test-runs`);

        // Wait for sidebar to load
        await page.waitForSelector("#sidebar-prompts", { state: "visible" });
        await page.waitForFunction(() => {
            const sidebar = document.querySelector("#sidebar-prompts");
            return sidebar && !sidebar.textContent?.includes("Loading");
        });

        // Select the prompt from sidebar
        const promptSelectorTestRuns = page
            .locator("#sidebar-prompts .sidebar-group-header")
            .filter({ hasText: PROMPT_NAME })
            .first();
        await promptSelectorTestRuns.waitFor({ state: "visible" });
        await promptSelectorTestRuns.click();

        // Wait for test section to be visible
        await page.waitForSelector("#test-section", { state: "visible" });

        // Wait for models to load
        await page.waitForSelector("#test-models-selection", { state: "visible" });
        await page.waitForFunction(
            () => {
                const container = document.querySelector("#test-models-selection");
                return container && !container.textContent?.includes("Loading");
            },
            { timeout: 10000 }
        );

        // Find and check the Deepseek model checkbox
        const deepseekCheckbox = page
            .locator('#test-models-selection input[type="checkbox"][data-provider="Deepseek"]')
            .first();
        await deepseekCheckbox.waitFor({ state: "visible", timeout: 10000 });
        await deepseekCheckbox.check();

        // Verify run button is enabled
        const runBtn = page.locator("#run-btn");
        await expect(runBtn).toBeEnabled();

        // Click "Run Tests" button
        await runBtn.click();

        // Wait for progress section
        await page.waitForSelector("#progress-section", { state: "visible" });

        // Wait for results section (with extended timeout for LLM API call)
        await page.waitForSelector("#results-section", { state: "visible", timeout: 120000 });

        // Verify score badges are visible
        const overallScoreBadge = page.locator("#overall-score-badge");
        await expect(overallScoreBadge).toBeVisible();
        const scoreText = await overallScoreBadge.textContent();
        expect(scoreText).toMatch(/\d+%/);

        // Verify LLM results are visible
        const llmResults = page.locator("#llm-results");
        await expect(llmResults).toBeVisible();

        // Click "View details" button
        const viewDetailsBtn = page.locator(".btn-view-details").first();
        await expect(viewDetailsBtn).toBeVisible();
        await viewDetailsBtn.click();

        // Verify the test details modal opens
        await page.waitForSelector("#test-details-modal.active", { state: "visible" });
        await expect(page.locator("#test-details-content")).toBeVisible();

        // Close the modal
        await page.click("#test-details-close-btn");
        await page.waitForSelector("#test-details-modal.active", { state: "hidden" });

        // ============================================
        // Step 6: Navigate to Auto-Improve and Execute
        // ============================================
        await page.goto(`${server.baseUrl}/improve`);

        // Wait for sidebar to load
        await page.waitForSelector("#sidebar-prompts", { state: "visible" });
        await page.waitForFunction(() => {
            const sidebar = document.querySelector("#sidebar-prompts");
            return sidebar && !sidebar.textContent?.includes("Loading");
        });

        // Select the prompt from sidebar
        const promptSelectorImprove = page
            .locator("#sidebar-prompts .sidebar-group-header")
            .filter({ hasText: PROMPT_NAME })
            .first();
        await promptSelectorImprove.waitFor({ state: "visible" });
        await promptSelectorImprove.click();

        // Wait for improve section to be visible
        await page.waitForSelector("#improve-section", { state: "visible" });

        // Wait for model selections to load
        await page.waitForSelector("#improvement-model-selection", { state: "visible" });
        await page.waitForFunction(
            () => {
                const container = document.querySelector("#improvement-model-selection");
                return container && !container.textContent?.includes("Loading");
            },
            { timeout: 10000 }
        );

        // Select Deepseek as improvement model (radio button)
        const improvementRadio = page
            .locator('#improvement-model-selection input[type="radio"][data-provider="Deepseek"]')
            .first();
        await improvementRadio.waitFor({ state: "visible" });
        await improvementRadio.check();

        // Wait for benchmark models section
        await page.waitForSelector("#benchmark-models-selection", { state: "visible" });

        // Select Deepseek as benchmark model (checkbox)
        const benchmarkCheckbox = page
            .locator('#benchmark-models-selection input[type="checkbox"][data-provider="Deepseek"]')
            .first();
        await benchmarkCheckbox.waitFor({ state: "visible" });
        await benchmarkCheckbox.check();

        // Set max iterations to 1
        const maxIterationsInput = page.locator("#max-iterations");
        await maxIterationsInput.fill("1");

        // Verify start button is enabled and click it
        const startBtn = page.locator("#start-btn");
        await expect(startBtn).toBeEnabled();
        await startBtn.click();

        // Wait for progress section
        await page.waitForSelector("#progress-section", { state: "visible" });

        // Wait for completion (with extended timeout for LLM API calls)
        await page.waitForSelector('#status-badge:has-text("Completed")', {
            state: "visible",
            timeout: 180000,
        });

        // Verify log output is visible and has content
        const logOutput = page.locator("#log-output");
        await expect(logOutput).toBeVisible();
        const logText = await logOutput.textContent();
        expect(logText).toBeTruthy();
        expect(logText!.length).toBeGreaterThan(0);

        // Verify score displays are visible
        const originalScore = page.locator("#original-score");
        const bestScore = page.locator("#best-score");
        await expect(originalScore).toBeVisible();
        await expect(bestScore).toBeVisible();

        // Verify scores have valid content
        const originalScoreText = await originalScore.textContent();
        const bestScoreText = await bestScore.textContent();
        expect(originalScoreText).toMatch(/\d+%|--/);
        expect(bestScoreText).toMatch(/\d+%|--/);

        // Verify all major buttons are still visible and actionable
        await expect(page.locator("#setup-btn")).toBeVisible();
        await expect(page.locator("#new-prompt-btn")).toBeVisible();
    });
});
