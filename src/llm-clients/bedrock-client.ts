import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
    BedrockClient as AWSBedrockClient,
    ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";
import { CompletionOptions, LLMClient, ModelInfo } from "./llm-client";
import { getConfig } from "../runtime/config";
import { ConfigurationError } from "../errors";

const STRUCTURED_OUTPUT_SCHEMA_NAME = "relia_prompt_response";

export class BedrockClient implements LLMClient {
    providerId = "bedrock";
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
                maxAttempts: 1,
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

    refresh(): void {
        this.runtimeClient = null;
        this.bedrockClient = null;
    }

    async listModels(): Promise<ModelInfo[]> {
        const client = this.getBedrockClient();
        if (!client) {
            return [];
        }

        try {
            const summaries = [];
            let nextToken: string | undefined;

            do {
                const response = await client.send(
                    new ListInferenceProfilesCommand({
                        typeEquals: "SYSTEM_DEFINED",
                        maxResults: 1000,
                        nextToken,
                    })
                );

                if (response.inferenceProfileSummaries) {
                    summaries.push(...response.inferenceProfileSummaries);
                }

                nextToken = response.nextToken;
            } while (nextToken);

            return summaries
                .filter(
                    (summary) =>
                        summary.status === "ACTIVE" &&
                        summary.inferenceProfileId?.startsWith("global.")
                )
                .map((summary) => ({
                    id: summary.inferenceProfileId!,
                    name: summary.inferenceProfileName || summary.inferenceProfileId!,
                    provider: this.providerId,
                }))
                .sort((left, right) => {
                    const nameComparison = left.name.localeCompare(right.name);
                    if (nameComparison !== 0) {
                        return nameComparison;
                    }
                    return left.id.localeCompare(right.id);
                });
        } catch {
            return [];
        }
    }

    private buildOutputConfig(outputSchema: Record<string, unknown>) {
        return {
            textFormat: {
                type: "json_schema" as const,
                structure: {
                    jsonSchema: {
                        schema: JSON.stringify(outputSchema),
                        name: STRUCTURED_OUTPUT_SCHEMA_NAME,
                    },
                },
            },
        };
    }

    private extractTextFromResponse(
        content: Array<{ text?: string | null }> | undefined
    ): string | null {
        if (!content || content.length === 0) {
            return null;
        }

        for (const block of content) {
            if (block.text !== undefined && block.text !== null) {
                return block.text;
            }
        }

        return null;
    }

    private async makeRequest(
        messages: Array<{ role: "user"; content: string }>,
        modelId: string,
        systemPrompt?: string,
        options?: CompletionOptions,
        defaultValue: string = ""
    ): Promise<string> {
        const client = this.getRuntimeClient();
        if (!client) {
            throw new ConfigurationError("Bedrock credentials not configured");
        }

        const outputSchema = options?.outputSchema;
        const outputConfig =
            outputSchema && typeof outputSchema === "object"
                ? this.buildOutputConfig(outputSchema)
                : undefined;

        const sendConverse = async (useSystemParam: boolean) => {
            let finalMessages = messages;
            if (!useSystemParam && systemPrompt) {
                finalMessages = messages.map((message, index) => {
                    if (index === 0) {
                        return {
                            ...message,
                            content: `${systemPrompt}\n\n${message.content}`,
                        };
                    }
                    return message;
                });
            }

            const command = new ConverseCommand({
                modelId,
                messages: finalMessages.map((message) => ({
                    role: message.role,
                    content: [{ text: message.content }],
                })),
                system: useSystemParam && systemPrompt ? [{ text: systemPrompt }] : undefined,
                inferenceConfig: {
                    maxTokens: 4096,
                },
                ...(outputConfig ? { outputConfig } : {}),
            });

            return client.send(command);
        };

        try {
            let response;
            try {
                response = await sendConverse(true);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes("system messages") && systemPrompt) {
                    response = await sendConverse(false);
                } else {
                    throw error;
                }
            }

            const text = this.extractTextFromResponse(response.output?.message?.content);

            if (text === null) {
                const stopReason = response.stopReason;
                if (stopReason && stopReason !== "end_turn") {
                    throw new Error(`Model stopped unexpectedly: ${stopReason}`);
                }
                if (defaultValue) {
                    return defaultValue;
                }
                throw new Error("Model returned empty response");
            }

            return text;
        } catch (error) {
            if (error instanceof ConfigurationError) {
                throw error;
            }

            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("ValidationException")) {
                throw new Error(
                    `Model ${modelId} may not support the Converse API: ${errorMessage}`,
                    { cause: error }
                );
            }
            if (errorMessage.includes("AccessDeniedException")) {
                throw new Error(
                    `Access denied for model ${modelId}. Ensure model access is enabled in AWS Bedrock console.`,
                    { cause: error }
                );
            }
            if (errorMessage.includes("ResourceNotFoundException")) {
                throw new Error(
                    `Model ${modelId} not found. It may not be available in your region.`,
                    { cause: error }
                );
            }

            throw error;
        }
    }

    async complete(
        systemPrompt: string,
        userMessage: string,
        modelId: string,
        options?: CompletionOptions
    ): Promise<string> {
        return this.makeRequest(
            [{ role: "user", content: userMessage }],
            modelId,
            systemPrompt,
            options
        );
    }
}

export const bedrockClient = new BedrockClient();
