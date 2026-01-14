import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    // Load env from parent directory (project root) where .env lives
    const env = loadEnv(mode, "..", "");
    const backendPort = env.PORT || "3000";

    return {
        plugins: [sveltekit()],
        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target: `http://localhost:${backendPort}`,
                    changeOrigin: true,
                },
            },
        },
    };
});
