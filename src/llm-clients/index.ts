export * from "./llm-client";
export { openaiClient } from "./openai-client";
export { bedrockClient } from "./bedrock-client";
export { deepseekClient } from "./deepseek-client";
export { geminiClient } from "./gemini-client";
export { groqClient } from "./groq-client";
export { openrouterClient } from "./openrouter-client";

import { LLMClient, setActiveClients } from "./llm-client";
import { openaiClient } from "./openai-client";
import { bedrockClient } from "./bedrock-client";
import { deepseekClient } from "./deepseek-client";
import { geminiClient } from "./gemini-client";
import { groqClient } from "./groq-client";
import { openrouterClient } from "./openrouter-client";

const allClients: LLMClient[] = [
    openaiClient,
    bedrockClient,
    deepseekClient,
    geminiClient,
    groqClient,
    openrouterClient,
];
setActiveClients(allClients);

export function refreshClients(): void {
    openaiClient.reset();
    bedrockClient.reset();
    geminiClient.reset();
    openrouterClient.reset();
    setActiveClients(allClients);
}
