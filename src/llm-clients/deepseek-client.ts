import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError, LLMError } from "../errors";
import type { ChangeHistory } from "../services/improvement-service";

interface DeepseekModel {
    id: string;
    object: string;
    owned_by: string;
}

interface DeepseekModelsResponse {
    object: string;
    data: DeepseekModel[];
}

export class DeepseekClient implements LLMClient {
    name = "Deepseek";
    private baseUrl = "https://api.deepseek.com";

    private getApiKey(): string | null {
        return getConfig("deepseek_api_key");
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
                const error = await response.text();
                console.error(`Deepseek list models failed: ${response.status} - ${error}`);
                return [];
            }

            const data = (await response.json()) as DeepseekModelsResponse;
            return data.data.map((model) => ({
                id: model.id,
                name: this.formatModelName(model.id),
                provider: "Deepseek",
            }));
        } catch (error) {
            console.error("Failed to fetch Deepseek models:", error);
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
            throw new ConfigurationError("Deepseek API key not configured");
        }

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
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
            throw new LLMError("Deepseek", `API error: ${response.status} - ${error}`);
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
            0.7,
            modelId,
            currentPrompt
        );
    }
}

export const deepseekClient = new DeepseekClient();
