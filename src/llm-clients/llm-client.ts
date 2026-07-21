export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

export type ProviderId = string;

export interface LLMCompletionTrace {
    content: string;
    requestPayload?: string;
    responsePayload?: string;
}

export interface LLMCompletionOptions {
    responseSchema?: Record<string, unknown>;
}

export interface LLMClient {
    providerId: ProviderId;
    isConfigured(): boolean;
    listModels(): Promise<ModelInfo[]>;
    complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string>;
    completeWithTrace?(
        systemPrompt: string,
        userMessage: string,
        modelId: string,
        options?: LLMCompletionOptions
    ): Promise<LLMCompletionTrace>;
    refresh(): void;
}

let activeClients: LLMClient[] = [];

export function setActiveClients(clients: LLMClient[]): void {
    activeClients = clients;
}

export function getConfiguredClients(): LLMClient[] {
    return activeClients.filter((client) => client.isConfigured());
}

import type { SelectedModel } from "../../shared/types";

export type ModelSelection = SelectedModel;

export async function getAllAvailableModels(): Promise<ModelInfo[]> {
    const configuredClients = getConfiguredClients();
    const modelPromises = configuredClients.map((client) => client.listModels());
    const modelArrays = await Promise.all(modelPromises);
    return modelArrays.flat();
}
