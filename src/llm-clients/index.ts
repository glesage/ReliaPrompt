export * from "./llm-client";
export { openaiClient } from "./openai-client";
export { bedrockClient } from "./bedrock-client";
export { deepseekClient } from "./deepseek-client";
export { geminiClient } from "./gemini-client";

import { LLMClient, setActiveClients } from "./llm-client";
import { openaiClient } from "./openai-client";
import { bedrockClient } from "./bedrock-client";
import { deepseekClient } from "./deepseek-client";
import { geminiClient } from "./gemini-client";

const allClients: LLMClient[] = [openaiClient, bedrockClient, deepseekClient, geminiClient];
setActiveClients(allClients);

export function refreshClients(): void {
    openaiClient.reset();
    bedrockClient.reset();
    geminiClient.reset();
    setActiveClients(allClients);
}

export { allClients };
