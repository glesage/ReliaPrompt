import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { LLMClient, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";

export class BedrockClient implements LLMClient {
    name = "Bedrock";
    private client: BedrockRuntimeClient | null = null;

    private getClient(): BedrockRuntimeClient | null {
        const accessKeyId = getConfig("bedrock_access_key_id");
        const secretAccessKey = getConfig("bedrock_secret_access_key");
        const region = getConfig("bedrock_region") || "us-east-1";

        if (!accessKeyId || !secretAccessKey) {
            return null;
        }

        if (!this.client) {
            this.client = new BedrockRuntimeClient({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
        }
        return this.client;
    }

    isConfigured(): boolean {
        return !!(getConfig("bedrock_access_key_id") && getConfig("bedrock_secret_access_key"));
    }

    async complete(systemPrompt: string, userMessage: string): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new Error("Bedrock credentials not configured");
        }

        const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

        const payload = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 4096,
            temperature: 0.1,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: userMessage,
                },
            ],
        };

        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        return responseBody.content?.[0]?.text ?? "";
    }

    async improvePrompt(currentPrompt: string, testResults: TestResultSummary[]): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new Error("Bedrock credentials not configured");
        }

        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);
        const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

        const payload = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 4096,
            temperature: 0.7,
            messages: [
                {
                    role: "user",
                    content: improvementPrompt,
                },
            ],
        };

        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        return responseBody.content?.[0]?.text ?? currentPrompt;
    }
}

export const bedrockClient = new BedrockClient();
