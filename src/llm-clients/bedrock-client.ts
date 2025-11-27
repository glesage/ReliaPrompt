import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
    BedrockClient as AWSBedrockClient,
    ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock";
import { LLMClient, ModelInfo, TestResultSummary, buildImprovementPrompt } from "./llm-client";
import { getConfig } from "../database";
import { ConfigurationError } from "../errors";

export class BedrockClient implements LLMClient {
    name = "Bedrock";
    private runtimeClient: BedrockRuntimeClient | null = null;
    private bedrockClient: AWSBedrockClient | null = null;

    private getCredentials(): {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        region: string;
    } | null {
        const accessKeyId = getConfig("bedrock_access_key_id");
        const secretAccessKey = getConfig("bedrock_secret_access_key");
        const sessionToken = getConfig("bedrock_session_token");
        const region = getConfig("bedrock_region") || "ap-southeast-2";

        if (!accessKeyId || !secretAccessKey) {
            return null;
        }

        return { accessKeyId, secretAccessKey, sessionToken: sessionToken || undefined, region };
    }

    private getRuntimeClient(): BedrockRuntimeClient | null {
        const creds = this.getCredentials();
        if (!creds) {
            return null;
        }

        if (!this.runtimeClient) {
            this.runtimeClient = new BedrockRuntimeClient({
                region: creds.region,
                credentials: {
                    accessKeyId: creds.accessKeyId,
                    secretAccessKey: creds.secretAccessKey,
                    sessionToken: creds.sessionToken,
                },
            });
        }
        return this.runtimeClient;
    }

    private getBedrockClient(): AWSBedrockClient | null {
        const creds = this.getCredentials();
        if (!creds) {
            return null;
        }

        if (!this.bedrockClient) {
            this.bedrockClient = new AWSBedrockClient({
                region: creds.region,
                credentials: {
                    accessKeyId: creds.accessKeyId,
                    secretAccessKey: creds.secretAccessKey,
                    sessionToken: creds.sessionToken,
                },
            });
        }
        return this.bedrockClient;
    }

    isConfigured(): boolean {
        return !!(getConfig("bedrock_access_key_id") && getConfig("bedrock_secret_access_key"));
    }

    reset(): void {
        this.runtimeClient = null;
        this.bedrockClient = null;
    }

    async listModels(): Promise<ModelInfo[]> {
        const client = this.getBedrockClient();
        if (!client) {
            return [];
        }

        try {
            const command = new ListFoundationModelsCommand({
                byOutputModality: "TEXT",
                byInferenceType: "ON_DEMAND",
            });

            const response = await client.send(command);
            const models: ModelInfo[] = [];

            for (const model of response.modelSummaries ?? []) {
                if (model.modelId && model.modelName) {
                    models.push({
                        id: model.modelId,
                        name: model.modelName,
                        provider: this.name,
                    });
                }
            }

            models.sort((a, b) => a.name.localeCompare(b.name));
            return models;
        } catch {
            return [];
        }
    }

    private async makeRequest(
        messages: Array<{ role: "user"; content: string }>,
        modelId: string,
        systemPrompt?: string,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getRuntimeClient();
        if (!client) {
            throw new ConfigurationError("Bedrock credentials not configured");
        }

        // Use the Converse API which provides a unified interface across all models
        const command = new ConverseCommand({
            modelId,
            messages: messages.map((m) => ({
                role: m.role,
                content: [{ text: m.content }],
            })),
            system: systemPrompt ? [{ text: systemPrompt }] : undefined,
            inferenceConfig: {
                maxTokens: 4096,
            },
        });

        const response = await client.send(command);
        return response.output?.message?.content?.[0]?.text ?? defaultValue;
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        return this.makeRequest([{ role: "user", content: userMessage }], modelId, systemPrompt);
    }

    async improvePrompt(
        currentPrompt: string,
        testResults: TestResultSummary[],
        modelId: string
    ): Promise<string> {
        const improvementPrompt = buildImprovementPrompt(currentPrompt, testResults);
        return this.makeRequest(
            [{ role: "user", content: improvementPrompt }],
            modelId,
            undefined,
            currentPrompt
        );
    }
}

export const bedrockClient = new BedrockClient();
