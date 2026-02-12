# Basic service example

This example shows how to use ReliaPrompt as a library in your service: define prompts and tests in code, run them from unit tests, and optionally use the UI in library mode.

## Setup

From the **relia-prompt repo root**:

```bash
cd example
bun install
```

## Define prompts and tests

Edit `reliaprompt.definitions.ts` to define prompts and test cases with `definePrompt`, `defineTestCase`, and `defineSuite`. Export a `suites` array for the UI and tests.

## Run tests

```bash
# Unit test (validates suite shape; skips real LLM run if OPENAI_API_KEY is not set)
bun test

# With real LLM run (set OPENAI_API_KEY)
OPENAI_API_KEY=sk-... bun test
```

## Run the UI (library mode)

From **relia-prompt repo root** (so the example is the "project"):

```bash
cd example
NODE_ENV=development bun run ../src/cli-ui.ts
```

Or from this directory after linking:

```bash
bun run reliaprompt:ui
```

Then open http://localhost:3000. You should see the "extract-entities" prompt and its test cases (read-only). Configure LLM keys in the UI and run tests with required model selection.
