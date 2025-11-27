# LLM Prompt Testing Tool

A web application for testing agentic server-side prompts against multiple LLMs with automated scoring and prompt improvement capabilities.

## Features

- **Multi-LLM Testing**: Test prompts against Multiple LLMs and models
- **Parallel Execution**: Run tests in parallel across all LLMs
- **10x Repeatability**: Each test case runs n times per LLM to measure consistency
- **Auto-Improvement**: LLMs automatically suggest and test prompt improvements
- **Version Control**: All prompts are versioned with full history

## Quick Start

1. **Install dependencies:**

    ```bash
    bun install
    ```

2. **Start the development server:**

    ```bash
    bun dev
    ```

3. **Open the app:**
   Navigate to http://localhost:3000

4. **Configure API Keys:**
    - Go to Configuration page
    - Add your OpenAI, Bedrock, and/or Deepseek API keys
    - At least one provider must be configured to run tests

## Usage

### 1. Create Prompts

- Navigate to "Prompts" page
- Enter a name and the system prompt content
- Prompts are automatically versioned

### 2. Add Test Cases

- Navigate to "Test Cases" page
- Select a prompt from the dropdown
- Add test cases with:
    - **Input**: The user message to send to the LLM
    - **Expected Output**: Valid JSON that the LLM should return

### 3. Run Tests

- Navigate to "Run Tests" page
- Select a prompt with test cases
- Click "Run Tests"
- Watch progress bars as tests execute
- View detailed results with per-LLM scores

### 4. Auto-Improve Prompts

- Navigate to "Auto-Improve" page
- Select a prompt with test cases
- Set max iterations (how many improvement attempts)
- Click "Start Improvement"
- Watch the log as LLMs analyze failures and suggest improvements
- Best improvements are automatically saved as new versions

## How It Works

### Test Execution

1. For each test case × LLM combination:
    - Send the system prompt + test input to the LLM
    - Parse the response as JSON
    - Compare against expected output (exact match after normalization)
    - Repeat 10 times to measure consistency
2. Calculate scores per LLM and overall

### Auto-Improvement

1. Test the original prompt and record failures
2. For each iteration:
    - Send failed test results to all LLMs
    - Ask each LLM to suggest an improved prompt
    - Test each suggestion
    - Keep the best-scoring version
    - Revert if no improvement found
3. Save the best version automatically

## API Endpoints

### Configuration

- `GET /api/config` - Get all config (API keys masked)
- `POST /api/config` - Update API keys
- `GET /api/config/providers` - List configured LLM providers

### Prompts

- `GET /api/prompts` - Get latest version of each prompt
- `GET /api/prompts/all` - Get all prompt versions
- `POST /api/prompts` - Create a new prompt
- `GET /api/prompts/:id` - Get a specific prompt by ID
- `GET /api/prompts/:name/versions` - Get version history by name
- `DELETE /api/prompts/:id` - Delete a specific prompt version
- `DELETE /api/prompts/:id/all-versions` - Delete all versions of a prompt (by ID)

### Test Cases

- `GET /api/prompts/:id/test-cases` - Get test cases for a prompt
- `POST /api/prompts/:id/test-cases` - Create a test case
- `PUT /api/test-cases/:id` - Update a test case
- `DELETE /api/test-cases/:id` - Delete a test case

### Test Runs

- `POST /api/test/run` - Start test run (returns jobId)
- `GET /api/test/status/:jobId` - Poll test progress

### Auto-Improvement

- `POST /api/improve/start` - Start improvement job
- `GET /api/improve/status/:jobId` - Poll improvement progress

## Project Structure

```
├── src/
│   ├── server.ts           # Express server and routes
│   ├── database.ts         # Database operations
│   ├── db/
│   │   ├── index.ts        # Database initialization
│   │   └── schema.ts       # Drizzle schema
│   ├── llm-clients/        # LLM provider clients
│   │   ├── llm-client.ts   # Unified interface
│   │   ├── openai-client.ts
│   │   ├── bedrock-client.ts
│   │   └── deepseek-client.ts
│   ├── services/
│   │   ├── test-runner.ts  # Test execution service
│   │   └── improvement-service.ts
│   └── utils/
│       └── json-comparison.ts
├── public/                 # Frontend files
│   ├── index.html
│   ├── prompts.html
│   ├── test-cases.html
│   ├── test-runs.html
│   ├── improve.html
│   └── styles.css
├── drizzle/                # Database migrations
└── data/                   # SQLite database (auto-created)
```

## Development

```bash
bun dev
bun run build
bun start
bun run format
bun run db:generate
bun run db:studio
```

## License

MIT
