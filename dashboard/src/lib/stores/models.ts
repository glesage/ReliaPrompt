import { writable, derived, get } from "svelte/store";
import type { Model, SelectedModel } from "$lib/types";
import * as api from "$lib/api";
import { showError } from "./messages";

// Available models (from API)
export const availableModels = writable<Model[]>([]);

const SELECTED_MODELS_STORAGE_KEY = "relia-prompt-selected-models";

// Selected models (persisted to localStorage; keys are .env-only)
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

// Load selected models from localStorage
export async function loadSelectedModels(): Promise<void> {
    try {
        const raw =
            typeof localStorage !== "undefined"
                ? localStorage.getItem(SELECTED_MODELS_STORAGE_KEY)
                : null;
        if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed)) {
                selectedModels.set(parsed as SelectedModel[]);
                return;
            }
        }
        selectedModels.set([]);
    } catch {
        selectedModels.set([]);
    }
}

// Save selected models to localStorage
export function saveSelectedModels(): void {
    try {
        const models = get(selectedModels);
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(SELECTED_MODELS_STORAGE_KEY, JSON.stringify(models));
        }
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

// Filter selected models to only include those that are currently available
function filterOrphanedModels(): boolean {
    const available = get(availableModels);
    const selected = get(selectedModels);

    // Create a set of available model keys for fast lookup
    const availableKeys = new Set(available.map((m) => `${m.provider}:${m.id}`));

    // Filter out any selected models that are no longer available
    const filtered = selected.filter((m) => availableKeys.has(`${m.provider}:${m.modelId}`));

    // If any were filtered out, update the store
    if (filtered.length !== selected.length) {
        selectedModels.set(filtered);
        return true;
    }
    return false;
}

// Initialize models (load both available and selected)
export async function initModels(): Promise<void> {
    await Promise.all([loadAvailableModels(), loadSelectedModels()]);

    // Clean up any orphaned model selections and save if needed
    const hadOrphans = filterOrphanedModels();
    if (hadOrphans) {
        saveSelectedModels();
    }
}
