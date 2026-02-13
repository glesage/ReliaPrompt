import { writable, get } from "svelte/store";
import * as api from "$lib/api";
import type { PromptSuiteDefinition } from "$lib/api";

export const librarySuites = writable<PromptSuiteDefinition[]>([]);
export const selectedLibrarySuiteId = writable<string | null>(null);

/** Call on app load to load suites from the project (code-first, no DB). */
export async function initUiMode(): Promise<void> {
    try {
        const suites = await api.getLibrarySuites();
        librarySuites.set(suites);
    } catch {
        librarySuites.set([]);
    }
}

export const selectedLibrarySuite = writable<PromptSuiteDefinition | null>(null);

/** Set selected suite by id and update selectedLibrarySuite. */
export function selectLibrarySuite(suiteId: string | null): void {
    selectedLibrarySuiteId.set(suiteId);
    if (!suiteId) {
        selectedLibrarySuite.set(null);
        return;
    }
    const suites = get(librarySuites);
    const suite = suites.find((s) => s.id === suiteId) ?? null;
    selectedLibrarySuite.set(suite);
}
