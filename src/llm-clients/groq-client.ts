import { LLMClient, LLMCompletionTrace, ModelInfo } from "./llm-client";
import { formatModelName } from "./utils";
import { getConfig } from "../runtime/config";
import { ConfigurationError, LLMError } from "../errors";

interface GroqModel {
    id: string;
    object: string;
    owned_by: string;
}

interface GroqModelsResponse {
    object: string;
    data: GroqModel[];
}

export class GroqClient implements LLMClient {
    providerId = "groq";
    private baseUrl = "https://api.groq.com/openai/v1";

    refresh(): void {}

    private getApiKey(): string | null {
        return getConfig("groq_api_key");
    }

    isConfigured(): boolean {
        return !!this.getApiKey();
    }

    async listModels(): Promise<ModelInfo[]> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) return [];

            const data = (await response.json()) as GroqModelsResponse;
            return data.data
                .filter((model) => model.id.includes("oss") || model.id.includes("qwen3.6"))
                .map((model) => ({
                    id: model.id,
                    name: formatModelName(model.id),
                    provider: this.providerId,
                }));
        } catch {
            return [];
        }
    }

    private async makeRequest(
        messages: Array<{ role: "system" | "user"; content: string }>,
        temperature: number,
        modelId: string,
        defaultValue: string = ""
    ): Promise<LLMCompletionTrace> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ConfigurationError("Groq API key not configured");
        }

        const requestBody: Record<string, unknown> = {
            model: modelId,
            messages,
            temperature,
            max_tokens: 4096,
            response_format: { type: "json_object" },
        };
        const requestPayload = JSON.stringify(requestBody);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: requestPayload,
        });
        const responsePayload = await response.text();

        if (!response.ok) {
            throw new LLMError(
                "Groq",
                `API error: ${response.status} - ${responsePayload}`,
                requestPayload,
                responsePayload
            );
        }

        const parsedResponsePayload = JSON.parse(responsePayload) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return {
            content: parsedResponsePayload.choices?.[0]?.message?.content ?? defaultValue,
            requestPayload,
            responsePayload,
        };
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        const completion = await this.completeWithTrace(systemPrompt, userMessage, modelId);
        return completion.content;
    }

    async completeWithTrace(
        systemPrompt: string,
        userMessage: string,
        modelId: string
    ): Promise<LLMCompletionTrace> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            0.1,
            modelId,
            ""
        );
    }
}

export const groqClient = new GroqClient();
