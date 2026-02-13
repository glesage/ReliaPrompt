/**
 * Shared utilities for LLM clients.
 */

/** Format a model id (e.g. "llama-3-70b") into a display name (e.g. "Llama 3 70b"). */
export function formatModelName(modelId: string): string {
    return modelId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
