import OpenAI from "openai";
import { LLMClient, ModelInfo, CompletionOptions } from "./llm-client";
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
        options: CompletionOptions | undefined,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new ConfigurationError("OpenAI API key not configured");
        }

        const requestBody: Parameters<typeof client.responses.create>[0] = {
            model: modelId,
            input: messages,
            stream: false,
            max_output_tokens: 4096,
            text: {
                format: { type: "json_object" },
            },
        };

        if (options?.reasoningLevel) {
            requestBody.reasoning = {
                effort: options.reasoningLevel,
            };
        }

        const response = await client.responses.create(requestBody);

        if ("output_text" in response) {
            return response.output_text ?? defaultValue;
        }

        return defaultValue;
    }

    async complete(
        systemPrompt: string,
        userMessage: string,
        modelId: string,
        options?: CompletionOptions
    ): Promise<string> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            modelId,
            options,
            ""
        );
    }
}

export const openaiClient = new OpenAIClient();
