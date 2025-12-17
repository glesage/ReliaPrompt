import { spawn, ChildProcess } from "child_process";
import path from "path";

export interface ServerInstance {
    process: ChildProcess;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
}

export async function e2eServer(): Promise<ServerInstance> {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const baseUrl = `http://localhost:${port}`;

    const serverPath = path.join(process.cwd(), "src", "server.ts");
    const serverProcess = spawn("bun", ["run", serverPath], {
        env: process.env,
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
                // Wait a bit for the process to terminate
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
                console.error("Error stopping test server:", error);
            }
        },
    };
}

async function waitForServer(baseUrl: string): Promise<void> {
    const startTime = Date.now();
    const maxWait = 3000;

    while (Date.now() - startTime < maxWait) {
        try {
            const response = await fetch(`${baseUrl}/api/config`);
            if (response.ok) return;
        } catch {
            // Ignore, continue waiting
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Server did not become ready in time");
}
