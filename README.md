# Relia Prompt

Test and benchmark LLM prompts across multiple providers and models.  
This tool is aimed at agentic use-cases for large production applications that require fast and reliable llm calls. For example, extracting sentiment from social media posts, converting a sentence into structured JSON, etc.

<img width="1612" height="931" alt="Screenshot" src="https://github.com/user-attachments/assets/acf9619a-1ebf-4c66-a597-10864a1c472f" />

## Features

- **Multi-Provider Testing** – OpenAI, Bedrock, DeepSeek, Gemini, Groq, OpenRouter
- **Parallel Execution** – Run tests concurrently across all configured LLMs
- **Repeatability** – Each test runs N times per model to measure consistency
- **Version Control** – Full prompt history with easy rollback

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Open http://localhost:3000
```

Configure API keys in the app's Configuration page. At least one provider is required.

## Usage

1. **Prompts** – Create and version your system prompts
2. **Test Cases** – Add input/expected output pairs (JSON) for each prompt
3. **Test Runs** – Execute tests and view per-model scores

## Development

```bash
bun dev              # Backend with hot reload
bun dev:frontend     # Frontend dev server
bun run build        # Build frontend + backend
bun run lint         # Lint backend
bun run test         # Unit tests
bun run test:e2e     # E2E tests (Playwright)
bun run format       # Format code
bun run db:studio    # Drizzle Studio
```

## Project Structure

```
├── src/                    # Backend (Express + Bun)
│   ├── server.ts           # API routes
│   ├── db/                  # Drizzle schema & init
│   ├── llm-clients/        # Provider clients
│   └── services/           # Test runner
├── frontend/               # SvelteKit app
│   └── src/
│       ├── lib/            # Components & stores
│       └── routes/         # Pages
├── drizzle/                # Database migrations
└── data/                   # SQLite database
```

## License

MIT
