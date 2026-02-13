import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    reporter: "html",
    workers: 1,
    use: {
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
