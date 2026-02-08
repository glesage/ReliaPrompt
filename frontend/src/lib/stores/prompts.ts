import { writable, derived, get } from "svelte/store";
import type { Prompt, PromptGroup } from "$lib/types";
import * as api from "$lib/api";
import { showError, showSuccess } from "./messages";

// Prompt groups (list in sidebar)
export const promptGroups = writable<PromptGroup[]>([]);

// Currently selected prompt
export const selectedPrompt = writable<Prompt | null>(null);

// Expanded prompt groups (by promptGroupId)
export const expandedGroups = writable<Set<number>>(new Set());

// Versions cache (keyed by promptGroupId)
export const versionsCache = writable<Record<number, Prompt[]>>({});

// Search filter
export const promptFilter = writable<string>("");

// Loading state
export const promptsLoading = writable<boolean>(false);

// Derived: filtered prompt groups
export const filteredPromptGroups = derived(
    [promptGroups, promptFilter],
    ([$promptGroups, $filter]) => {
        const query = $filter.trim().toLowerCase();
        if (!query) return $promptGroups;
        return $promptGroups.filter((p) => p.name.toLowerCase().includes(query));
    }
);

// Load all prompt groups
export async function loadPrompts(): Promise<void> {
    promptsLoading.set(true);
    try {
        const groups = await api.getPrompts();
        promptGroups.set(groups);

        // If we have a selected prompt, make sure its group is expanded
        const current = get(selectedPrompt);
        if (current) {
            expandedGroups.update((set) => {
                set.add(current.promptGroupId);
                return set;
            });
        }
    } catch (error) {
        showError("Error loading prompts");
    } finally {
        promptsLoading.set(false);
    }
}

// Load versions for a specific prompt group
export async function loadVersions(groupId: number, promptId: number): Promise<Prompt[]> {
    try {
        const versions = await api.getPromptVersions(promptId);
        versionsCache.update((cache) => ({ ...cache, [groupId]: versions }));
        return versions;
    } catch (error) {
        showError("Error loading prompt versions");
        return [];
    }
}

// Select a prompt by ID
export async function selectPrompt(id: number): Promise<void> {
    try {
        const prompt = await api.getPrompt(id);
        selectedPrompt.set(prompt);

        // Store in session storage for persistence
        sessionStorage.setItem("selectedPromptId", id.toString());

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set("promptId", id.toString());
        window.history.replaceState({}, "", url.toString());

        // Expand the group
        expandedGroups.update((set) => {
            set.add(prompt.promptGroupId);
            return set;
        });
    } catch (error) {
        showError("Error loading prompt");
    }
}

// Deselect the current prompt
export function deselectPrompt(): void {
    selectedPrompt.set(null);
    sessionStorage.removeItem("selectedPromptId");

    const url = new URL(window.location.href);
    url.searchParams.delete("promptId");
    window.history.replaceState({}, "", url.toString());
}

// Toggle group expansion
export async function toggleGroup(groupId: number, promptId: number): Promise<void> {
    const $expandedGroups = get(expandedGroups);
    const isExpanded = $expandedGroups.has(groupId);

    if (isExpanded) {
        // Collapse
        expandedGroups.update((set) => {
            set.delete(groupId);
            return new Set(set);
        });
    } else {
        // Collapse all others first (accordion behavior)
        expandedGroups.set(new Set([groupId]));

        // Load versions if not cached
        const cache = get(versionsCache);
        if (!cache[groupId]) {
            await loadVersions(groupId, promptId);
        }

        // Auto-select the latest version
        const versions = get(versionsCache)[groupId];
        if (versions && versions.length > 0) {
            await selectPrompt(versions[0].id);
        }
    }
}

// Create a new prompt
export async function createPrompt(data: {
    name: string;
    content: string;
    expectedSchema?: string;
    evaluationMode?: "schema" | "llm";
    evaluationCriteria?: string;
}): Promise<Prompt | null> {
    try {
        const prompt = await api.createPrompt(data);

        // Reload prompts list
        await loadPrompts();

        // Load versions for the new prompt's group and select it
        await loadVersions(prompt.promptGroupId, prompt.id);
        await selectPrompt(prompt.id);

        showSuccess("Prompt created successfully!");
        return prompt;
    } catch (error) {
        showError((error as Error).message || "Failed to create prompt");
        return null;
    }
}

// Create a new version of an existing prompt
export async function createPromptVersion(
    parentId: number,
    name: string,
    content: string,
    expectedSchema?: string,
    evaluationMode?: "schema" | "llm",
    evaluationCriteria?: string
): Promise<Prompt | null> {
    try {
        const prompt = await api.createPrompt({
            name,
            content,
            expectedSchema,
            evaluationMode,
            evaluationCriteria,
            parentVersionId: parentId,
        });

        // Reload prompts list
        await loadPrompts();

        // Reload versions for this group and select the new version
        await loadVersions(prompt.promptGroupId, prompt.id);
        await selectPrompt(prompt.id);

        showSuccess("New version saved!");
        return prompt;
    } catch (error) {
        showError((error as Error).message || "Failed to save prompt");
        return null;
    }
}

// Delete a single version
export async function deletePromptVersion(id: number, groupId: number): Promise<boolean> {
    try {
        await api.deletePrompt(id);
        showSuccess("Version deleted");

        // Reload prompts list
        await loadPrompts();

        // Check if the group still exists
        const groups = get(promptGroups);
        const group = groups.find((g) => g.promptGroupId === groupId);

        if (group) {
            // Group still exists, reload its versions
            const versions = await loadVersions(groupId, group.id);

            // If the deleted prompt was selected, select the latest version
            const current = get(selectedPrompt);
            if (current?.id === id && versions.length > 0) {
                await selectPrompt(versions[0].id);
            } else if (current?.id === id) {
                deselectPrompt();
            }
        } else {
            // Group was deleted (no more versions), clear selection
            const current = get(selectedPrompt);
            if (current?.promptGroupId === groupId) {
                deselectPrompt();
            }

            // Clean up cache and expanded state
            versionsCache.update((cache) => {
                const newCache = { ...cache };
                delete newCache[groupId];
                return newCache;
            });
            expandedGroups.update((set) => {
                set.delete(groupId);
                return new Set(set);
            });
        }

        return true;
    } catch (error) {
        showError((error as Error).message || "Failed to delete version");
        return false;
    }
}

// Delete all versions of a prompt
export async function deleteAllVersions(id: number, groupId: number): Promise<boolean> {
    try {
        await api.deleteAllPromptVersions(id);
        showSuccess("Prompt deleted");

        // Clear selection if it was from this group
        const current = get(selectedPrompt);
        if (current?.promptGroupId === groupId) {
            deselectPrompt();
        }

        // Clear cache and collapsed state
        versionsCache.update((cache) => {
            const newCache = { ...cache };
            delete newCache[groupId];
            return newCache;
        });
        expandedGroups.update((set) => {
            set.delete(groupId);
            return new Set(set);
        });

        await loadPrompts();
        return true;
    } catch (error) {
        showError((error as Error).message || "Failed to delete prompt");
        return false;
    }
}

// Restore selection from session storage or URL
export async function restoreSelection(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPromptId = urlParams.get("promptId");
    const storedId = sessionStorage.getItem("selectedPromptId");

    const idToRestore = urlPromptId || storedId;
    if (idToRestore) {
        const id = parseInt(idToRestore, 10);
        if (!isNaN(id)) {
            await selectPrompt(id);
        }
    }
}

// Format version date
export function formatVersionDate(dateStr: string): string {
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yy}.${mm}.${dd} - ${hh}:${min}:${ss}`;
}
