import { test, expect } from "@playwright/test";
import { e2eServer, type ServerInstance } from "./e2eServer";

test.describe("User Journey E2E", () => {
    let server: ServerInstance | null = null;

    test.beforeEach(async () => {
        server = await e2eServer();
    });

    test.afterEach(async () => {
        if (server) {
            await server.close();
            server = null;
        }
    });

    test("library mode: open config, select suite, run tests and view results", async ({
        page,
    }) => {
        if (!server) throw new Error("Server not started");

        await page.goto(server.baseUrl);
        await page.waitForSelector(".app-layout", { state: "visible" });

        await page.click("#setup-btn");
        await page.waitForSelector("#config-modal.active", { state: "visible" });

        await page.click("#config-close-btn");
        await page.waitForSelector("#config-modal.active", { state: "hidden" });

        await page.waitForSelector("#sidebar-prompts", { state: "visible" });
        const firstSuiteRow = page.locator("#sidebar-prompts .prompts-table-row").first();
        try {
            await firstSuiteRow.waitFor({ state: "visible", timeout: 15000 });
        } catch {
            test.skip(true, "No suites loaded (example project may not be available)");
            return;
        }

        await firstSuiteRow.click();
        await page.waitForSelector("#test-cases-list", { state: "visible" });

        await page.waitForSelector("#test-models-selection", { state: "visible" });
        const firstModelCheckbox = page
            .locator('#test-models-selection input[type="checkbox"]')
            .first();
        await firstModelCheckbox.waitFor({ state: "visible", timeout: 10000 });
        await firstModelCheckbox.check();

        const runBtn = page.locator("#run-btn");
        await expect(runBtn).toBeEnabled();
        await runBtn.click();

        await page.waitForSelector("#progress-section", { state: "visible" });
        await page.waitForSelector("#results-section", { state: "visible", timeout: 120000 });

        const overallScoreBadge = page.locator("#overall-score-badge");
        await expect(overallScoreBadge).toBeVisible();
        const scoreText = await overallScoreBadge.textContent();
        expect(scoreText).toMatch(/\d+%|\d/);

        const llmResults = page.locator("#llm-results");
        await expect(llmResults).toBeVisible();

        const viewDetailsBtn = page.locator(".btn-view-details").first();
        await expect(viewDetailsBtn).toBeVisible();
        await viewDetailsBtn.click();

        await page.waitForSelector("#test-details-modal.active", { state: "visible" });
        await expect(page.locator("#test-details-content")).toBeVisible();

        await page.click("#test-details-close-btn");
        await page.waitForSelector("#test-details-modal.active", { state: "hidden" });

        await expect(page.locator("#setup-btn")).toBeVisible();
    });
});
