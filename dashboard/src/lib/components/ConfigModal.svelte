<script lang="ts">
    import Modal from "./Modal.svelte";
    import ModelSelector from "./ModelSelector.svelte";
    import { closeConfigModal, configModalOpen, isProviderConfigured } from "$lib/stores/config";
    import { availableModels, selectedModels, saveSelectedModels } from "$lib/stores/models";
    import type { SelectedModel } from "$lib/types";
    import { PROVIDERS } from "$shared/providers";

    function getModelsForProvider(provider: string) {
        return $availableModels.filter((m) => m.provider === provider);
    }

    function handleModelChange(provider: string, models: SelectedModel[]) {
        const otherModels = $selectedModels.filter((m) => m.provider !== provider);
        const newSelection = [...otherModels, ...models.filter((m) => m.provider === provider)];
        selectedModels.set(newSelection);
        saveSelectedModels();
    }

    function getJsonHint(providerId: string): string {
        const provider = PROVIDERS.find((p) => p.id === providerId);
        if (!provider) return `${providerId}.{...}`;
        const fields = Object.keys(provider.jsonFieldMap);
        return `${providerId}.{${fields.join(", ")}}`;
    }
</script>

<Modal
    id="config-modal"
    open={$configModalOpen}
    title="LLM Configuration"
    onclose={closeConfigModal}
>
    <p class="config-notice">
        API keys are read from <code>.env</code> only. Edit <code>.env</code> and restart the server to
        change keys.
    </p>

    <div class="provider-list">
        {#each PROVIDERS as provider}
            <div class="provider-section">
                <h3>
                    {provider.id}
                    <span
                        class="status-badge"
                        class:configured={isProviderConfigured(provider.id)}
                        class:not-configured={!isProviderConfigured(provider.id)}
                    >
                        {isProviderConfigured(provider.id) ? "Configured" : "Not configured"}
                    </span>
                </h3>
                <p class="env-hint">
                    json: <code>{getJsonHint(provider.id)}</code>
                </p>
                {#if getModelsForProvider(provider.id).length > 0}
                    <div class="form-group">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label>Models</label>
                        <ModelSelector
                            selectedModels={$selectedModels}
                            onchange={(models) => handleModelChange(provider.id, models)}
                            filterProvider={provider.id}
                        />
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#snippet footer()}
        <button id="config-close-btn" type="button" class="primary" onclick={closeConfigModal}
            >Close</button
        >
    {/snippet}
</Modal>

<style>
    .config-notice {
        margin-bottom: 1rem;
        padding: 0.5rem 0.75rem;
        background: var(--color-surface-alt, #f0f0f0);
        border-radius: 6px;
        font-size: var(--text-md);
    }
    .config-notice code {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
    }
    .env-hint {
        margin: 0.25rem 0 0.5rem;
        font-size: var(--text-base);
        color: var(--color-text-muted, #666);
    }
    .env-hint code {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
    }
    .provider-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .provider-section {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-border, #eee);
    }
    .provider-section:last-child {
        border-bottom: none;
    }
    .form-group {
        margin-top: 0.5rem;
    }
</style>
