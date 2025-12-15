import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
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
    name = "Groq";
    private baseUrl = "https://api.groq.com/openai/v1";

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

            if (!response.ok) {
                return [];
            }

            const data = (await response.json()) as GroqModelsResponse;
            const chatModels = data.data.filter(
                (model) =>
                    model.id.includes("llama-4-maverick") ||
                    model.id.includes("kimi-k2") ||
                    model.id.includes("compound")
            );
            return chatModels.map((model) => ({
                id: model.id,
                name: this.formatModelName(model.id),
                provider: "Groq",
            }));
        } catch {
            return [];
        }
    }

    private formatModelName(modelId: string): string {
        return modelId
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    private async makeRequest(
        messages: Array<{ role: "system" | "user"; content: string }>,
        temperature: number,
        modelId: string,
        defaultValue: string = ""
    ): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ConfigurationError("Groq API key not configured");
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages,
                temperature,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new LLMError("Groq", `API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            0.1,
            modelId
        );
    }

    async improvePrompt(
        currentPrompt: string,
        testResults: TestResultSummary[],
        modelId: string
    ): Promise<string> {
        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);
        return this.makeRequest(
            [{ role: "user", content: improvementPrompt }],
            0.7,
            modelId,
            currentPrompt
        );
    }
}

export const groqClient = new GroqClient();
