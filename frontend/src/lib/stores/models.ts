import { writable, derived, get } from "svelte/store";
import type { Model, SelectedModel } from "$lib/types";
import * as api from "$lib/api";
import { showError } from "./messages";

// Available models (from API)
export const availableModels = writable<Model[]>([]);

// Selected models (persisted to config)
export const selectedModels = writable<SelectedModel[]>([]);

// Loading state
export const modelsLoading = writable<boolean>(false);

// Derived: models grouped by provider
export const modelsByProvider = derived(availableModels, ($models) => {
    const grouped: Record<string, Model[]> = {};
    for (const model of $models) {
        if (!grouped[model.provider]) {
            grouped[model.provider] = [];
        }
        grouped[model.provider].push(model);
    }
    return grouped;
});

// Load available models
export async function loadAvailableModels(): Promise<void> {
    modelsLoading.set(true);
    try {
        const models = await api.getModels();
        availableModels.set(models);
    } catch (error) {
        availableModels.set([]);
    } finally {
        modelsLoading.set(false);
    }
}

// Load selected models from config
export async function loadSelectedModels(): Promise<void> {
    try {
        const config = await api.getConfig();
        if (config.selected_models) {
            try {
                const parsed = JSON.parse(config.selected_models);
                if (Array.isArray(parsed)) {
                    selectedModels.set(parsed);
                }
            } catch {
                selectedModels.set([]);
            }
        }
    } catch (error) {
        selectedModels.set([]);
    }
}

// Save selected models
export async function saveSelectedModels(): Promise<void> {
    try {
        const models = get(selectedModels);
        await api.saveSelectedModels(models);
    } catch (error) {
        showError("Error saving model selection");
    }
}

// Check if a model is selected
export function isModelSelected(provider: string, modelId: string): boolean {
    return get(selectedModels).some((m) => m.provider === provider && m.modelId === modelId);
}

// Toggle model selection
export function toggleModelSelection(provider: string, modelId: string): void {
    selectedModels.update((models) => {
        const index = models.findIndex((m) => m.provider === provider && m.modelId === modelId);
        if (index >= 0) {
            return models.filter((_, i) => i !== index);
        } else {
            return [...models, { provider, modelId }];
        }
    });
    saveSelectedModels();
}

// Get selected models count
export function getSelectedModelsCount(): number {
    return get(selectedModels).length;
}

// Initialize models (load both available and selected)
export async function initModels(): Promise<void> {
    await Promise.all([loadAvailableModels(), loadSelectedModels()]);
}
