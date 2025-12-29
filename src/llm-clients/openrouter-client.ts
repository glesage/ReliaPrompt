import { OpenRouter } from "@openrouter/sdk";
import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";
import type { ChangeHistory } from "../services/improvement-service";

export class OpenRouterClient implements LLMClient {
    name = "OpenRouter";
    private client: OpenRouter | null = null;
    private cachedApiKey: string | null = null;

    private getClient(): OpenRouter | null {
        if (this.cachedApiKey === null) {
            this.cachedApiKey = getConfig("openrouter_api_key");
        }

        if (!this.cachedApiKey) {
            return null;
        }

        if (!this.client) {
            this.client = new OpenRouter({
                apiKey: this.cachedApiKey,
            });
        }

        return this.client;
    }

    isConfigured(): boolean {
        if (this.cachedApiKey !== null) {
            return !!this.cachedApiKey;
        }
        this.cachedApiKey = getConfig("openrouter_api_key");
        return !!this.cachedApiKey;
    }

    reset(): void {
        this.cachedApiKey = null;
        this.client = null;
    }

    async listModels(): Promise<ModelInfo[]> {
        const client = this.getClient();
        if (!client) {
            return [];
        }

        try {
            const response = await client.models.list();
            const models: ModelInfo[] = [];

            for (const model of response.data) {
                if (
                    ![
                        "google/gemini-2.5-flash",
                        "qwen/qwen3-235b-a22b-2507",
                        "bytedance-seed/seedream-4.5",
                    ].includes(model.id)
                ) {
                    continue;
                }
                models.push({
                    id: model.id,
                    name: model.id,
                    provider: this.name,
                });
            }

            models.sort((a, b) => a.name.localeCompare(b.name));
            return models;
        } catch {
            return [];
        }
    }

    private async makeRequest(
        messages: Array<{ role: "system" | "user"; content: string }>,
        modelId: string,
        temperature: number,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new ConfigurationError("OpenRouter API key not configured");
        }

        const response = await client.chat.send({
            model: modelId,
            messages,
            temperature,
            maxCompletionTokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (typeof content === "string") {
            return content;
        }
        return defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            modelId,
            0.1
        );
    }

    async improvePrompt(
        currentPrompt: string,
        testResults: TestResultSummary[],
        modelId: string,
        previousChanges?: ChangeHistory[]
    ): Promise<string> {
        const improvementPrompt = buildImprovementPrompt(
            currentPrompt,
            testResults,
            previousChanges
        );
        return this.makeRequest(
            [{ role: "user", content: improvementPrompt }],
            modelId,
            0.7,
            currentPrompt
        );
    }
}

export const openrouterClient = new OpenRouterClient();
