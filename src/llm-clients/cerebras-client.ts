import { LLMClient, LLMCompletionOptions, LLMCompletionTrace, ModelInfo } from "./llm-client";
import { formatModelName } from "./utils";
import { getConfig } from "../runtime/config";
import { ConfigurationError, LLMError } from "../errors";

interface CerebrasModel {
    id: string;
    object: string;
    owned_by: string;
}

interface CerebrasModelsResponse {
    object: string;
    data: CerebrasModel[];
}

const unsupportedStrictSchemaKeywords = new Set([
    "$schema",
    "default",
    "description",
    "examples",
    "format",
    "maxItems",
    "minItems",
    "pattern",
    "title",
]);

export function toCerebrasStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
    return removeUnsupportedStrictSchemaKeywords(schema) as Record<string, unknown>;
}

function removeUnsupportedStrictSchemaKeywords(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(removeUnsupportedStrictSchemaKeywords);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !unsupportedStrictSchemaKeywords.has(key))
            .map(([key, nestedValue]) => [key, removeUnsupportedStrictSchemaKeywords(nestedValue)])
    );
}

export class CerebrasClient implements LLMClient {
    providerId = "cerebras";
    private baseUrl = "https://api.cerebras.ai/v1";

    refresh(): void {}

    private getApiKey(): string | null {
        return getConfig("cerebras_api_key");
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

            const data = (await response.json()) as CerebrasModelsResponse;
            return data.data.map((model) => ({
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
        defaultValue: string = "",
        options?: LLMCompletionOptions
    ): Promise<LLMCompletionTrace> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ConfigurationError("Cerebras API key not configured");
        }

        const requestBody: Record<string, unknown> = {
            model: modelId,
            messages,
            temperature,
            max_tokens: 4096,
            response_format: options?.responseSchema
                ? {
                      type: "json_schema",
                      json_schema: {
                          name: "nls_response",
                          strict: true,
                          schema: toCerebrasStrictSchema(options.responseSchema),
                      },
                  }
                : { type: "json_object" },
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
                "Cerebras",
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
        modelId: string,
        options?: LLMCompletionOptions
    ): Promise<LLMCompletionTrace> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            0.1,
            modelId,
            "",
            options
        );
    }
}

export const cerebrasClient = new CerebrasClient();
