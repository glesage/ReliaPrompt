import OpenAI from "openai";
import { LLMClient, ModelInfo } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";

export class OpenAIClient implements LLMClient {
    name = "OpenAI";
    private client: OpenAI | null = null;
    private cachedApiKey: string | null = null;

    private getClient(): OpenAI | null {
        if (this.cachedApiKey === null) {
            this.cachedApiKey = getConfig("openai_api_key");
        }

        if (!this.cachedApiKey) {
            return null;
        }

        if (!this.client) {
            this.client = new OpenAI({ apiKey: this.cachedApiKey });
        }

        return this.client;
    }

    isConfigured(): boolean {
        if (this.cachedApiKey !== null) {
            return !!this.cachedApiKey;
        }
        this.cachedApiKey = getConfig("openai_api_key");
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

            for await (const model of response) {
                if (!model.id.startsWith("gpt-5") || model.id.includes("2025")) continue;
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
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new ConfigurationError("OpenAI API key not configured");
        }

        const response = await client.responses.create({
            model: modelId,
            input: messages,
            max_output_tokens: 4096,
            text: {
                format: { type: "json_object" },
            },
        });

        return response.output_text ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            modelId,
            ""
        );
    }
}

export const openaiClient = new OpenAIClient();
