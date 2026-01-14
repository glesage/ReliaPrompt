<script lang="ts">
    import type { Model, SelectedModel } from "$lib/types";
    import { modelsByProvider, availableModels } from "$lib/stores/models";

    interface Props {
        selectedModels: SelectedModel[];
        onchange: (models: SelectedModel[]) => void;
        filterProvider?: string;
        mode?: "checkbox" | "radio";
    }

    let { selectedModels, onchange, filterProvider, mode = "checkbox" }: Props = $props();

    const modelsToShow = $derived(
        filterProvider
            ? $availableModels.filter((m) => m.provider === filterProvider)
            : $availableModels
    );

    const grouped = $derived(() => {
        const result: Record<string, Model[]> = {};
        for (const model of modelsToShow) {
            if (!result[model.provider]) {
                result[model.provider] = [];
            }
            result[model.provider].push(model);
        }
        return result;
    });

    function isSelected(provider: string, modelId: string): boolean {
        return selectedModels.some((m) => m.provider === provider && m.modelId === modelId);
    }

    function handleChange(provider: string, modelId: string, checked: boolean) {
        if (mode === "radio") {
            // Single selection
            onchange([{ provider, modelId }]);
        } else {
            // Multi selection
            if (checked) {
                if (!isSelected(provider, modelId)) {
                    onchange([...selectedModels, { provider, modelId }]);
                }
            } else {
                onchange(selectedModels.filter((m) => !(m.provider === provider && m.modelId === modelId)));
            }
        }
    }

    function escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
</script>

<div class="model-selection-container">
    {#if modelsToShow.length === 0}
        <div class="no-models">No models available. Configure API keys first.</div>
    {:else}
        {#each Object.entries(grouped()) as [provider, models]}
            <div class="model-provider-group">
                {#if !filterProvider}
                    <h4>{provider}</h4>
                {/if}
                <div class="model-list">
                    {#each models as model}
                        <label class="model-checkbox">
                            <input
                                type={mode}
                                name={mode === "radio" ? "model-selection" : undefined}
                                checked={isSelected(model.provider, model.id)}
                                data-provider={model.provider}
                                data-model-id={model.id}
                                onchange={(e) =>
                                    handleChange(model.provider, model.id, (e.target as HTMLInputElement).checked)}
                            />
                            <span class="model-name">{model.name}</span>
                        </label>
                    {/each}
                </div>
            </div>
        {/each}
    {/if}
</div>
