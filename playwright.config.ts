import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    reporter: "html",
    use: {
        baseURL: "http://localhost:3000",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
