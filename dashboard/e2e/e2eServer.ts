import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

export interface ServerInstance {
    process: ChildProcess;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
}

/** Repo root: this file is dashboard/e2e/e2eServer.ts, so go up two levels. */
const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".."
);

const E2E_PORT = 3099;

/**
 * Start the ReliaPrompt backend server (parent project).
 * Uses REPO_ROOT so it works regardless of process.cwd(). Uses port 3099 by default to avoid clashing with dev.
 */
export async function e2eServer(): Promise<ServerInstance> {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : E2E_PORT;
    const baseUrl = `http://localhost:${port}`;

    const serverProcess = spawn("bun", ["run", "src/server.ts"], {
        cwd: REPO_ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
    });

    await waitForServer(baseUrl);

    return {
        process: serverProcess,
        port,
        baseUrl,
        close: async () => {
            try {
                serverProcess.kill();
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
                console.error("Error stopping test server:", error);
            }
        },
    };
}

async function waitForServer(baseUrl: string): Promise<void> {
    const startTime = Date.now();
    const maxWait = 15000;

    while (Date.now() - startTime < maxWait) {
        try {
            const response = await fetch(`${baseUrl}/api/config`);
            if (response.ok) return;
        } catch {
            // Ignore, continue waiting
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(
        `Server did not become ready in time. Ensure the dashboard is built (bun run build:dashboard from repo root) and port ${E2E_PORT} is free.`
    );
}
