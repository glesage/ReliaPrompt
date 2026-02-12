import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        alias: { $backend: "../src", $shared: "../shared" },
        adapter: adapter({
            pages: "dist",
            assets: "dist",
            fallback: "index.html",
            precompress: false,
            strict: true,
        }),
        paths: {
            base: "",
        },
    },
};

export default config;
