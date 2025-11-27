import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { LLMClient, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";

/**
 * Response structure from Bedrock Claude models.
 */
interface BedrockClaudeResponse {
    content?: Array<{
        type: string;
        text?: string;
    }>;
    id?: string;
    model?: string;
    stop_reason?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

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

    private async makeRequest(
        messages: Array<{ role: "user"; content: string }>,
        temperature: number,
        systemPrompt?: string,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getClient();
        if (!client) {
            throw new ConfigurationError("Bedrock credentials not configured");
        }

        const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";

        const payload: {
            anthropic_version: string;
            max_tokens: number;
            temperature: number;
            system?: string;
            messages: Array<{ role: "user"; content: string }>;
        } = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 4096,
            temperature,
            messages,
        };

        if (systemPrompt) {
            payload.system = systemPrompt;
        }

        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(
            new TextDecoder().decode(response.body)
        ) as BedrockClaudeResponse;

        return responseBody.content?.[0]?.text ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string): Promise<string> {
        return this.makeRequest(
            [{ role: "user", content: userMessage }],
            0.1,
            systemPrompt
        );
    }

    async improvePrompt(currentPrompt: string, testResults: TestResultSummary[]): Promise<string> {
        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);
        return this.makeRequest(
            [{ role: "user", content: improvementPrompt }],
            0.7,
            undefined,
            currentPrompt
        );
    }
}

export const bedrockClient = new BedrockClient();
