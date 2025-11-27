import OpenAI from "openai";
import { LLMClient, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";

export class OpenAIClient implements LLMClient {
    name = "OpenAI";
    private client: OpenAI | null = null;
    private cachedApiKey: string | null = null;

    private getClient(): OpenAI | null {
        // Only read config if we don't have a cached key or client
        if (this.cachedApiKey === null) {
            this.cachedApiKey = getConfig("openai_api_key");
        }

        if (!this.cachedApiKey) {
            return null;
        }

        // Create client if it doesn't exist
        if (!this.client) {
            this.client = new OpenAI({ apiKey: this.cachedApiKey });
        }

        return this.client;
    }

    isConfigured(): boolean {
        // Use cached key if available, otherwise read from config
        if (this.cachedApiKey !== null) {
            return !!this.cachedApiKey;
        }
        this.cachedApiKey = getConfig("openai_api_key");
        return !!this.cachedApiKey;
    }

    /**
     * Reset the cached API key and client. Call this when the config changes.
     */
    reset(): void {
        this.cachedApiKey = null;
        this.client = null;
    }

    private async makeRequest(
        messages: Array<{ role: "system" | "user"; content: string }>,
        temperature: number,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new ConfigurationError("OpenAI API key not configured");
        }

        const response = await client.chat.completions.create({
            model: "gpt-4o",
            messages,
            temperature,
            max_tokens: 4096,
        });

        return response.choices[0]?.message?.content ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string): Promise<string> {
        return this.makeRequest(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            0.1
        );
    }

    async improvePrompt(currentPrompt: string, testResults: TestResultSummary[]): Promise<string> {
        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);
        return this.makeRequest([{ role: "user", content: improvementPrompt }], 0.7, currentPrompt);
    }
}

export const openaiClient = new OpenAIClient();
