import OpenAI from "openai";
import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";
import type { ChangeHistory } from "../services/improvement-service";

export class OpenRouterClient implements LLMClient {
    name = "OpenRouter";
    private client: OpenAI | null = null;
    private cachedApiKey: string | null = null;

    private getClient(): OpenAI | null {
        if (this.cachedApiKey === null) {
            this.cachedApiKey = getConfig("openrouter_api_key");
        }

        if (!this.cachedApiKey) {
            return null;
        }

        if (!this.client) {
            this.client = new OpenAI({
                apiKey: this.cachedApiKey,
                baseURL: "https://openrouter.ai/api/v1",
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
                if (!["x-ai/grok-4.1-fast", "mistralai/mistral-nemo"].includes(model.id)) {
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

        const response = await client.chat.completions.create({
            model: modelId,
            messages,
            temperature,
            max_completion_tokens: 4096,
        });

        return response.choices[0]?.message?.content ?? defaultValue;
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
