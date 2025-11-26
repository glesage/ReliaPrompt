import { LLMClient, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";

export class DeepseekClient implements LLMClient {
    name = "Deepseek";
    private baseUrl = "https://api.deepseek.com/v1";

    private getApiKey(): string | null {
        return getConfig("deepseek_api_key");
    }

    isConfigured(): boolean {
        return !!this.getApiKey();
    }

    async complete(systemPrompt: string, userMessage: string): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error("Deepseek API key not configured");
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Deepseek API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? "";
    }

    async improvePrompt(currentPrompt: string, testResults: TestResultSummary[]): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error("Deepseek API key not configured");
        }

        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: improvementPrompt }],
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Deepseek API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? currentPrompt;
    }
}

export const deepseekClient = new DeepseekClient();
