# Relia Prompt

Test and benchmark prompts accross LLM providers and models

This tool is aimed at agentic use-cases for large production applications that require fast and reliable llm calls. For example, extracting sentiment from social media posts, converting a sentence into structured JSON, etc.

<img width="1776" height="1068" alt="Screenshot 2026-02-24 at 1 20 54 pm" src="https://github.com/user-attachments/assets/c11a1a35-7741-43b2-95d6-12584ceedb70" />


## Features

- **Multi-Provider Testing** – OpenAI, Bedrock, DeepSeek, Gemini, Groq, OpenRouter
- **Parallel Execution** – Run tests concurrently across all configured LLMs
- **Repeatability** – Each test runs N times per model to measure consistency
- **Code-first** – Define prompts and tests in code

## Quick Start

Prompts and tests live in your code. Use the example project pattern:

```bash
# From a project that has reliaprompt.definitions.ts (see example)
cd example
bun install
bun run reliaprompt:ui   # or: from your app, add "reliaprompt:ui" and run from project root
# Open http://localhost:3000
```

Set credentials via the `RELIA_PROMPT_LLM_CONFIG_JSON` environment variable (see [Configuration](#configuration)). At least one provider is required.

## Usage

### Code-first (only mode)

Use ReliaPrompt inside your service for LLM benchmarking and testing from unit tests.

1. **Install** – Add `relia-prompt` as a dependency.
2. **Initialize** – Pass credentials at startup (or load from `RELIA_PROMPT_LLM_CONFIG_JSON` when using the UI):

    ```ts
    import {
        initializeReliaPrompt,
        runPromptTestsFromSuite,
        definePrompt,
        defineTestCase,
        defineSuite,
    } from "relia-prompt";

    initializeReliaPrompt({
        providers: {
            // Canonical keys can be provided directly in library mode.
            // For UI/server mode prefer RELIA_PROMPT_LLM_CONFIG_JSON in .env.
        },
    });
    ```

3. **Define prompts and tests in code** – Use the builder API and export `suites` for the UI:

    ```ts
    const prompt = definePrompt({ name: "my-prompt", content: "..." });
    const testCases = [
        defineTestCase({ input: "...", expectedOutput: "[...]", expectedOutputType: "array" }),
    ];
    export const suites = [defineSuite({ prompt, testCases })];
    ```

4. **Run tests** – Require `testModels` (and `evaluationModel` when using LLM evaluation) per run:

    ```ts
    const { score, results } = await runPromptTestsFromSuite(suite, {
      testModels: [{ provider: "provider-id", modelId: "model-id" }],
      evaluationModel: ..., // required when prompt.evaluationMode === "llm"
      runsPerTest: 1,
    });
    ```

5. **Optional UI** – From your project root (where your definitions live), run:

    ```bash
    yarn reliaprompt:ui
    ```

    The UI shows prompts and tests from your code (read-only tests; prompt edits in the browser are drafts only). Configure `RELIA_PROMPT_LLM_CONFIG_JSON` in `.env` and choose test/evaluation models on each run.

### Configuration

Configuration is JSON-only via `RELIA_PROMPT_LLM_CONFIG_JSON`.
Use `.env.example` as the canonical template for the full JSON object.

See [example](example) for a full example and smoke test.

## Development

```bash
bun dev              # Backend + dashboard with hot reload
bun run dev:backend  # Backend only with hot reload
bun dev:dashboard    # Dashboard dev server
bun run build        # Build dashboard + backend
bun run lint         # Lint backend
bun run test         # Unit tests
bun run test:e2e     # E2E tests (Playwright)
bun run format       # Format code
```

## Project Structure

```
├── src/                    # Backend (Express + Bun)
│   ├── server.ts           # API routes
│   ├── llm-clients/        # Provider clients
│   └── services/           # Test runner
├── dashboard/              # SvelteKit app
│   └── src/
│       ├── lib/            # Components & stores
│       └── routes/         # Pages
└── example/                # Example project
```

## License

MIT
