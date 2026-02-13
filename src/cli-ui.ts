/**
 * Start the ReliaPrompt UI in library mode (file-scan, code-first prompts/tests).
 * Run from your project root so that reliaprompt.definitions.ts (or files in reliaprompt.config) are found.
 *
 * Usage: yarn reliaprompt:ui   (from your project root)
 * Or:    npx reliaprompt ui
 */
import { startServer } from "./server";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const projectRoot = process.env.RELIAPROMPT_PROJECT_ROOT || process.cwd();

startServer({ projectRoot, port })
    .then((instance) => {
        console.log(`ReliaPrompt UI (library mode) at ${instance.baseUrl}`);
        console.log(`Project root: ${projectRoot}`);
    })
    .catch((err) => {
        console.error("Failed to start ReliaPrompt UI:", err);
        process.exit(1);
    });
