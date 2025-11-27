import { LLMClient, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError, LLMError } from "../errors";

export class DeepseekClient implements LLMClient {
    name = "Deepseek";
    private baseUrl = "https://api.deepseek.com/v1";

    private getApiKey(): string | null {
        return getConfig("deepseek_api_key");
    }

    isConfigured(): boolean {
        return !!this.getApiKey();
    }

    private async makeRequest(
        messages: Array<{ role: "system" | "user"; content: string }>,
        temperature: number,
        defaultValue: string = ""
    ): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ConfigurationError("Deepseek API key not configured");
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
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
        return this.makeRequest(
            [{ role: "user", content: improvementPrompt }],
            0.7,
            currentPrompt
        );
    }
}

export const deepseekClient = new DeepseekClient();
