import { writable, get } from "svelte/store";
import type { LLMConfig } from "$lib/types";
import * as api from "$lib/api";
import { showError, showSuccess } from "./messages";
import { loadAvailableModels } from "./models";

// Config state
export const config = writable<LLMConfig>({});

// Config modal open state
export const configModalOpen = writable<boolean>(false);

// Loading state
export const configLoading = writable<boolean>(false);

// Load config from API
export async function loadConfig(): Promise<void> {
    configLoading.set(true);
    try {
        const data = await api.getConfig();
        config.set(data);
    } catch (error) {
        showError("Error loading configuration");
    } finally {
        configLoading.set(false);
    }
}

// Save config
export async function saveConfig(data: Partial<LLMConfig>): Promise<boolean> {
    configLoading.set(true);
    try {
        await api.saveConfig(data);
        await loadConfig();
        await loadAvailableModels();
        showSuccess("Configuration saved successfully!");
        return true;
    } catch (error) {
        showError((error as Error).message || "Failed to save configuration");
        return false;
    } finally {
        configLoading.set(false);
    }
}

// Check if a provider is configured
export function isProviderConfigured(provider: string): boolean {
    const $config = get(config);
    switch (provider) {
        case "OpenAI":
            return !!$config.openai_api_key;
        case "Bedrock":
            return !!$config.bedrock_access_key_id && !!$config.bedrock_secret_access_key;
        case "Deepseek":
            return !!$config.deepseek_api_key;
        case "Gemini":
            return !!$config.gemini_api_key;
        case "Groq":
            return !!$config.groq_api_key;
        case "OpenRouter":
            return !!$config.openrouter_api_key;
        default:
            return false;
    }
}

// Open config modal
export function openConfigModal(): void {
    configModalOpen.set(true);
    loadConfig();
}

// Close config modal
export function closeConfigModal(): void {
    configModalOpen.set(false);
}
