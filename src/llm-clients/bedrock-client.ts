import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
    BedrockClient as AWSBedrockClient,
    ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock";
import { LLMClient, ModelInfo } from "./llm-client";
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

        // Helper to send the converse command
        const sendConverse = async (useSystemParam: boolean) => {
            // If not using system param, prepend system prompt to first user message
            let finalMessages = messages;
            if (!useSystemParam && systemPrompt) {
                finalMessages = messages.map((m, i) => {
                    if (i === 0) {
                        return {
                            ...m,
                            content: `${systemPrompt}\n\n${m.content}`,
                        };
                    }
                    return m;
                });
            }

            const command = new ConverseCommand({
                modelId,
                messages: finalMessages.map((m) => ({
                    role: m.role,
                    content: [{ text: m.content }],
                })),
                system: useSystemParam && systemPrompt ? [{ text: systemPrompt }] : undefined,
                inferenceConfig: {
                    maxTokens: 4096,
                },
            });

            return client.send(command);
        };

        try {
            // First try with system message parameter
            let response;
            try {
                response = await sendConverse(true);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // If model doesn't support system messages, retry with system prompt in user message
                if (errorMessage.includes("system messages") && systemPrompt) {
                    response = await sendConverse(false);
                } else {
                    throw error;
                }
            }

            const text = response.output?.message?.content?.[0]?.text;

            if (text === undefined || text === null) {
                // Check stop reason for more context
                const stopReason = response.stopReason;
                if (stopReason && stopReason !== "end_turn") {
                    throw new Error(`Model stopped unexpectedly: ${stopReason}`);
                }
                // Return defaultValue if provided, otherwise throw
                if (defaultValue) {
                    return defaultValue;
                }
                throw new Error("Model returned empty response");
            }

            return text;
        } catch (error) {
            // Re-throw ConfigurationError as-is
            if (error instanceof ConfigurationError) {
                throw error;
            }

            // Check for common Bedrock errors and provide clearer messages
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("ValidationException")) {
                throw new Error(
                    `Model ${modelId} may not support the Converse API: ${errorMessage}`
                );
            }
            if (errorMessage.includes("AccessDeniedException")) {
                throw new Error(
                    `Access denied for model ${modelId}. Ensure model access is enabled in AWS Bedrock console.`
                );
            }
            if (errorMessage.includes("ResourceNotFoundException")) {
                throw new Error(
                    `Model ${modelId} not found. It may not be available in your region.`
                );
            }

            throw error;
        }
    }

    async complete(systemPrompt: string, userMessage: string, modelId: string): Promise<string> {
        return this.makeRequest([{ role: "user", content: userMessage }], modelId, systemPrompt);
    }
}

export const bedrockClient = new BedrockClient();
