# Default behavior (docs-backed):

- OpenAI GPT-5 family (Responses/Chat): model-specific defaults.
    - gpt-5: reasoning default is medium
    - gpt-5.1: reasoning default is none
    - gpt-5.2: reasoning default is none
    - Controls: Responses uses reasoning.effort; Chat uses reasoning_effort
    - Docs: https://platform.openai.com/docs/guides/gpt-5 , https://platform.openai.com/docs/guides/reasoning
- DeepSeek:
    - deepseek-chat = non-thinking mode by default
    - deepseek-reasoner = thinking mode model
    - Docs: https://api-docs.deepseek.com/quick_start/pricing , https://api-docs.deepseek.com/guides/reasoning_model
- Groq reasoning models:
    - For GPT-OSS on Groq, reasoning is included by default in response (include_reasoning: true default)
    - Reasoning effort default shown as default in Groq reasoning docs
    - Docs: https://console.groq.com/docs/reasoning
- OpenRouter:
    - If a routed model emits reasoning, OpenRouter includes reasoning tokens by default unless excluded
    - Unified control is reasoning object
    - Docs: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
- Bedrock (Anthropic reasoning use case):
    - Reasoning is explicitly enabled with additionalModelRequestFields.thinking (as shown in AWS docs/examples)
    - Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_Converse_AnthropicClaudeReasoning_section.html
- Gemini thinking models:
    - Google docs state thinking process is enabled by default for supported thinking models
    - Docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking

# Reasoning test models

- gpt-5.2
- gpt-5.2-chat-latest
- deepseek-reasoner
- groq openai/gpt-oss-20b
- groq openai/gpt-oss-120b
- groq qwen/qwen3-32b

## How reasoning tests will run (for users)

When you select a model, you do not need to choose reasoning levels manually.

- For models with multiple reasoning levels (for example OpenAI GPT-5.2 family and Groq models that support levels), the runner will test all supported variants automatically.
- Each variant is shown as a separate label, such as:
    - `gpt-5.2 - no reasoning`
    - `gpt-5.2 - low reasoning`
    - `gpt-5.2 - medium reasoning`
    - `gpt-5.2 - high reasoning`
    - `gpt-5.2 - xhigh reasoning` (if supported)
- DeepSeek is handled by model choice, not levels:
    - `deepseek-chat` = no reasoning baseline
    - `deepseek-reasoner` = reasoning model
- Output shown to users will include only the final answer text. Reasoning traces/messages will not be shown.

### Comparison mode (with and without reasoning)

The goal is to compare quality and scores between:

- no reasoning
- reasoning low/medium/high (and xhigh where supported)

This means one selected model can produce multiple test rows, one per reasoning variant.

### Evaluation model policy

- Evaluator remains no reasoning.
- This keeps scoring consistent across all model/provider variants.

### Provider-specific behavior (simple rules)

- OpenAI (`gpt-5.2`, `gpt-5.2-chat-latest`): run no reasoning + all supported reasoning levels.
- DeepSeek (`deepseek-reasoner`): run as reasoning model (no extra level fan-out).
- Groq (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3-32b`): run no reasoning + supported reasoning levels for each model.
