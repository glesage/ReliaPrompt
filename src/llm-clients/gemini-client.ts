import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError, LLMError } from "../errors";
import type { ChangeHistory } from "../services/improvement-service";

interface GeminiModel {
    name: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
}

interface GeminiModelsResponse {
    models: GeminiModel[];
}

interface GeminiContent {
    role: string;
    parts: Array<{ text: string }>;
}

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

export class GeminiClient implements LLMClient {
    name = "Gemini";
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    private cachedApiKey: string | null = null;

    private getApiKey(): string | null {
        if (this.cachedApiKey === null) {
            this.cachedApiKey = getConfig("gemini_api_key");
        }
        return this.cachedApiKey;
    }

    isConfigured(): boolean {
        if (this.cachedApiKey !== null) {
            return !!this.cachedApiKey;
        }
        this.cachedApiKey = getConfig("gemini_api_key");
        return !!this.cachedApiKey;
    }

    reset(): void {
        this.cachedApiKey = null;
    }

    async listModels(): Promise<ModelInfo[]> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/models?key=${apiKey}`, {
                method: "GET",
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`Gemini list models failed: ${response.status} - ${error}`);
                return [];
            }

            const data = (await response.json()) as GeminiModelsResponse;
            return data.models
                .filter((model) => model.supportedGenerationMethods.includes("generateContent"))
                .filter((model) => model.displayName.includes("Gemini 3"))
                .map((model) => ({
                    id: model.name.replace("models/", ""),
                    name: model.displayName,
                    provider: this.name,
                }));
        } catch (error) {
            console.error("Failed to fetch Gemini models:", error);
            return [];
        }
    }

    private async makeRequest(
        contents: GeminiContent[],
        modelId: string,
        defaultValue: string = ""
    ): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ConfigurationError("Gemini API key not configured");
        }

        // Ensure model ID has proper format
        const modelPath = modelId.startsWith("models/") ? modelId : `models/${modelId}`;

        const response = await fetch(`${this.baseUrl}/${modelPath}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    maxOutputTokens: 4096,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new LLMError("Gemini", `API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as GeminiResponse;
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        // Gemini uses a different format - system instructions are passed separately
        // or we can combine them in the first user message
        const combinedMessage = systemPrompt
            ? `${systemPrompt}\n\n---\n\n${userMessage}`
            : userMessage;

        return this.makeRequest(
            [
                {
                    role: "user",
                    parts: [{ text: combinedMessage }],
                },
            ],
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
            [
                {
                    role: "user",
                    parts: [{ text: improvementPrompt }],
                },
            ],
            modelId,
            currentPrompt
        );
    }
}

export const geminiClient = new GeminiClient();
