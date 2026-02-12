import { writable, get } from "svelte/store";
import type { LLMConfig } from "$lib/types";
import * as api from "$lib/api";
import { isProviderConfigured as checkProviderConfigured } from "$shared/providers";
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

// Check if a provider id is configured (e.g. "openai")
export function isProviderConfigured(provider: string): boolean {
    return checkProviderConfigured(get(config), provider);
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
