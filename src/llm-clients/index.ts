export * from "./llm-client";
export { openaiClient } from "./openai-client";
export { bedrockClient } from "./bedrock-client";
export { cerebrasClient } from "./cerebras-client";
export { deepseekClient } from "./deepseek-client";
export { geminiClient } from "./gemini-client";
export { groqClient } from "./groq-client";
export { openrouterClient } from "./openrouter-client";

import { LLMClient, setActiveClients } from "./llm-client";
import { openaiClient } from "./openai-client";
import { bedrockClient } from "./bedrock-client";
import { cerebrasClient } from "./cerebras-client";
import { deepseekClient } from "./deepseek-client";
import { geminiClient } from "./gemini-client";
import { groqClient } from "./groq-client";
import { openrouterClient } from "./openrouter-client";

const registry: LLMClient[] = [
    openaiClient,
    bedrockClient,
    cerebrasClient,
    deepseekClient,
    geminiClient,
    groqClient,
    openrouterClient,
];
setActiveClients(registry);

export function getClient(providerId: string): LLMClient | undefined {
    const key = providerId.toLowerCase();
    return registry.find((c) => c.providerId.toLowerCase() === key);
}

export function refreshClients(): void {
    for (const client of registry) {
        client.refresh();
    }
    setActiveClients(registry);
}
