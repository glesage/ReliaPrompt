export * from "./llm-client";
export { openaiClient } from "./openai-client";
export { bedrockClient } from "./bedrock-client";
export { deepseekClient } from "./deepseek-client";

import { LLMClient, setActiveClients } from "./llm-client";
import { openaiClient } from "./openai-client";
import { bedrockClient } from "./bedrock-client";
import { deepseekClient } from "./deepseek-client";

// Initialize all clients
const allClients: LLMClient[] = [openaiClient, bedrockClient, deepseekClient];
setActiveClients(allClients);

export function refreshClients(): void {
    // Re-check which clients are configured
    // This is called after config changes
    setActiveClients(allClients);
}

export { allClients };
