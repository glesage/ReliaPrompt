<script lang="ts">
    import Modal from "./Modal.svelte";
    import ModelSelector from "./ModelSelector.svelte";
    import { config, configLoading, saveConfig, closeConfigModal, configModalOpen } from "$lib/stores/config";
    import { availableModels, selectedModels, loadAvailableModels, toggleModelSelection } from "$lib/stores/models";
    import type { SelectedModel } from "$lib/types";
    import { onMount } from "svelte";

    let formData = $state({
        openai_api_key: "",
        bedrock_access_key_id: "",
        bedrock_secret_access_key: "",
        bedrock_session_token: "",
        bedrock_region: "ap-southeast-2",
        deepseek_api_key: "",
        gemini_api_key: "",
        groq_api_key: "",
        openrouter_api_key: "",
    });

    // Sync form data when config changes
    $effect(() => {
        if ($config) {
            formData = {
                openai_api_key: $config.openai_api_key || "",
                bedrock_access_key_id: $config.bedrock_access_key_id || "",
                bedrock_secret_access_key: $config.bedrock_secret_access_key || "",
                bedrock_session_token: $config.bedrock_session_token || "",
                bedrock_region: $config.bedrock_region || "ap-southeast-2",
                deepseek_api_key: $config.deepseek_api_key || "",
                gemini_api_key: $config.gemini_api_key || "",
                groq_api_key: $config.groq_api_key || "",
                openrouter_api_key: $config.openrouter_api_key || "",
            };
        }
    });

    function isConfigured(provider: string): boolean {
        switch (provider) {
            case "openai":
                return !!$config.openai_api_key;
            case "bedrock":
                return !!$config.bedrock_access_key_id && !!$config.bedrock_secret_access_key;
            case "deepseek":
                return !!$config.deepseek_api_key;
            case "gemini":
                return !!$config.gemini_api_key;
            case "groq":
                return !!$config.groq_api_key;
            case "openrouter":
                return !!$config.openrouter_api_key;
            default:
                return false;
        }
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        const success = await saveConfig(formData);
        if (success) {
            await loadAvailableModels();
        }
    }

    function getModelsForProvider(provider: string) {
        return $availableModels.filter((m) => m.provider === provider);
    }

    function handleModelChange(provider: string, models: SelectedModel[]) {
        // Update selected models for this provider
        const otherModels = $selectedModels.filter((m) => m.provider !== provider);
        const newSelection = [...otherModels, ...models.filter((m) => m.provider === provider)];
        selectedModels.set(newSelection);
    }
</script>

<Modal id="config-modal" open={$configModalOpen} title="LLM Configuration" onclose={closeConfigModal}>
    <form id="config-form" onsubmit={handleSubmit}>
        <div class="provider-section">
            <h3>
                OpenAI
                <span class="status-badge" class:configured={isConfigured("openai")} class:not-configured={!isConfigured("openai")}>
                    {isConfigured("openai") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.openai_api_key}
                    placeholder="API Key (sk-...)"
                />
            </div>
            {#if getModelsForProvider("OpenAI").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("OpenAI", models)}
                        filterProvider="OpenAI"
                    />
                </div>
            {/if}
        </div>

        <div class="provider-section">
            <h3>
                AWS Bedrock
                <span class="status-badge" class:configured={isConfigured("bedrock")} class:not-configured={!isConfigured("bedrock")}>
                    {isConfigured("bedrock") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.bedrock_access_key_id}
                    placeholder="Access Key ID (AKIA...)"
                />
            </div>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.bedrock_secret_access_key}
                    placeholder="Secret Access Key"
                />
            </div>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.bedrock_session_token}
                    placeholder="Session Token (optional)"
                />
            </div>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.bedrock_region}
                    placeholder="Region (e.g., ap-southeast-2)"
                />
            </div>
            {#if getModelsForProvider("Bedrock").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("Bedrock", models)}
                        filterProvider="Bedrock"
                    />
                </div>
            {/if}
        </div>

        <div class="provider-section">
            <h3>
                Deepseek
                <span id="deepseek-status" class="status-badge" class:configured={isConfigured("deepseek")} class:not-configured={!isConfigured("deepseek")}>
                    {isConfigured("deepseek") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    id="deepseek_api_key"
                    type="text"
                    bind:value={formData.deepseek_api_key}
                    placeholder="API Key (sk-...)"
                />
            </div>
            {#if getModelsForProvider("Deepseek").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("Deepseek", models)}
                        filterProvider="Deepseek"
                    />
                </div>
            {/if}
        </div>

        <div class="provider-section">
            <h3>
                Gemini
                <span class="status-badge" class:configured={isConfigured("gemini")} class:not-configured={!isConfigured("gemini")}>
                    {isConfigured("gemini") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.gemini_api_key}
                    placeholder="API Key"
                />
            </div>
            {#if getModelsForProvider("Gemini").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("Gemini", models)}
                        filterProvider="Gemini"
                    />
                </div>
            {/if}
        </div>

        <div class="provider-section">
            <h3>
                Groq
                <span class="status-badge" class:configured={isConfigured("groq")} class:not-configured={!isConfigured("groq")}>
                    {isConfigured("groq") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.groq_api_key}
                    placeholder="API Key (gsk_...)"
                />
            </div>
            {#if getModelsForProvider("Groq").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("Groq", models)}
                        filterProvider="Groq"
                    />
                </div>
            {/if}
        </div>

        <div class="provider-section">
            <h3>
                OpenRouter
                <span class="status-badge" class:configured={isConfigured("openrouter")} class:not-configured={!isConfigured("openrouter")}>
                    {isConfigured("openrouter") ? "Configured" : "Not configured"}
                </span>
            </h3>
            <div class="form-group">
                <input
                    type="text"
                    bind:value={formData.openrouter_api_key}
                    placeholder="API Key (sk-or-v1-...)"
                />
            </div>
            {#if getModelsForProvider("OpenRouter").length > 0}
                <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Models</label>
                    <ModelSelector
                        selectedModels={$selectedModels}
                        onchange={(models) => handleModelChange("OpenRouter", models)}
                        filterProvider="OpenRouter"
                    />
                </div>
            {/if}
        </div>
    </form>

    {#snippet footer()}
        <button id="config-close-btn" type="button" class="secondary" onclick={closeConfigModal}>Cancel</button>
        <button type="submit" form="config-form" disabled={$configLoading}>
            {$configLoading ? "Saving..." : "Save Configuration"}
        </button>
    {/snippet}
</Modal>
