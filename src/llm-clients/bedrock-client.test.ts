import { describe, test, expect, beforeEach, mock } from "bun:test";
import { clearConfigOverlay, setConfigOverlay } from "../runtime/config";

const converseCommandInputs: unknown[] = [];
const listInferenceProfilesCommandInputs: unknown[] = [];
let lastRuntimeClientOptions: { maxAttempts?: number } | undefined;
let lastBedrockClientOptions: unknown;
let bedrockClientConstructionCount = 0;

const mockRuntimeSend = mock(() =>
    Promise.resolve({
        output: { message: { content: [{ text: "response text" }] } },
        stopReason: "end_turn",
    })
);

const mockListInferenceProfiles = mock(() =>
    Promise.resolve({
        inferenceProfileSummaries: [
            {
                inferenceProfileId: "global.openai.gpt-5.6-luna",
                inferenceProfileName: "GPT-5.6 Luna",
                status: "ACTIVE",
            },
            {
                inferenceProfileId: "global.openai.gpt-5.6-sol",
                inferenceProfileName: "GPT-5.6 Sol",
                status: "ACTIVE",
            },
        ],
    })
);

class MockConverseCommand {
    constructor(input: unknown) {
        converseCommandInputs.push(input);
    }
}

class MockListInferenceProfilesCommand {
    constructor(input: unknown) {
        listInferenceProfilesCommandInputs.push(input);
    }
}

mock.module("@aws-sdk/client-bedrock-runtime", () => ({
    BedrockRuntimeClient: class {
        send = mockRuntimeSend;
        constructor(options: { maxAttempts?: number }) {
            lastRuntimeClientOptions = options;
        }
    },
    ConverseCommand: MockConverseCommand,
}));

mock.module("@aws-sdk/client-bedrock", () => ({
    BedrockClient: class {
        send = mockListInferenceProfiles;
        constructor(options: unknown) {
            bedrockClientConstructionCount += 1;
            lastBedrockClientOptions = options;
        }
    },
    ListInferenceProfilesCommand: MockListInferenceProfilesCommand,
}));

import { bedrockClient } from "./bedrock-client";

function configureBedrock(overrides: Record<string, string> = {}): void {
    setConfigOverlay({
        bedrock_access_key_id: "test-access-key",
        bedrock_secret_access_key: "test-secret-key",
        bedrock_region: "us-east-1",
        ...overrides,
    });
}

beforeEach(() => {
    clearConfigOverlay();
    bedrockClient.refresh();
    mockRuntimeSend.mockClear();
    mockListInferenceProfiles.mockClear();
    converseCommandInputs.length = 0;
    listInferenceProfilesCommandInputs.length = 0;
    lastRuntimeClientOptions = undefined;
    lastBedrockClientOptions = undefined;
    bedrockClientConstructionCount = 0;
    mockListInferenceProfiles.mockImplementation(() =>
        Promise.resolve({
            inferenceProfileSummaries: [
                {
                    inferenceProfileId: "global.openai.gpt-5.6-luna",
                    inferenceProfileName: "GPT-5.6 Luna",
                    status: "ACTIVE",
                },
                {
                    inferenceProfileId: "global.openai.gpt-5.6-sol",
                    inferenceProfileName: "GPT-5.6 Sol",
                    status: "ACTIVE",
                },
            ],
        })
    );
});

describe("BedrockClient", () => {
    describe("listModels", () => {
        test("returns active global inference profiles from AWS", async () => {
            configureBedrock();

            expect(await bedrockClient.listModels()).toEqual([
                { id: "global.openai.gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "bedrock" },
                { id: "global.openai.gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "bedrock" },
            ]);
            expect(mockRuntimeSend).not.toHaveBeenCalled();
        });

        test("requests system-defined profiles from the configured source region", async () => {
            configureBedrock();

            await bedrockClient.listModels();

            expect(lastBedrockClientOptions).toEqual({
                region: "us-east-1",
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key",
                    sessionToken: undefined,
                },
            });
            expect(listInferenceProfilesCommandInputs[0]).toEqual({
                typeEquals: "SYSTEM_DEFINED",
                maxResults: 1000,
                nextToken: undefined,
            });
        });

        test("follows nextToken until all pages are loaded", async () => {
            configureBedrock();
            mockListInferenceProfiles
                .mockImplementationOnce(() =>
                    Promise.resolve({
                        inferenceProfileSummaries: [
                            {
                                inferenceProfileId: "global.openai.gpt-5.6-terra",
                                inferenceProfileName: "GPT-5.6 Terra",
                                status: "ACTIVE",
                            },
                        ],
                        nextToken: "page-2",
                    })
                )
                .mockImplementationOnce(() =>
                    Promise.resolve({
                        inferenceProfileSummaries: [
                            {
                                inferenceProfileId: "global.openai.gpt-5.6-luna",
                                inferenceProfileName: "GPT-5.6 Luna",
                                status: "ACTIVE",
                            },
                        ],
                    })
                );

            expect(await bedrockClient.listModels()).toEqual([
                { id: "global.openai.gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "bedrock" },
                { id: "global.openai.gpt-5.6-terra", name: "GPT-5.6 Terra", provider: "bedrock" },
            ]);
            expect(listInferenceProfilesCommandInputs).toEqual([
                { typeEquals: "SYSTEM_DEFINED", maxResults: 1000, nextToken: undefined },
                { typeEquals: "SYSTEM_DEFINED", maxResults: 1000, nextToken: "page-2" },
            ]);
        });

        test("filters inactive, non-global, and unnamed profiles and sorts deterministically", async () => {
            configureBedrock();
            mockListInferenceProfiles.mockImplementationOnce(() =>
                Promise.resolve({
                    inferenceProfileSummaries: [
                        {
                            inferenceProfileId: "global.openai.gpt-5.6-terra",
                            status: "ACTIVE",
                        },
                        {
                            inferenceProfileId: "global.openai.gpt-5.6-sol",
                            inferenceProfileName: "GPT-5.6 Sol",
                            status: "ACTIVE",
                        },
                        {
                            inferenceProfileId: "us.openai.gpt-5.6-luna",
                            inferenceProfileName: "US GPT-5.6 Luna",
                            status: "ACTIVE",
                        },
                        {
                            inferenceProfileId: "global.openai.gpt-5.6-luna",
                            inferenceProfileName: "GPT-5.6 Luna",
                            status: "INACTIVE",
                        },
                        {
                            inferenceProfileName: "Missing ID",
                            status: "ACTIVE",
                        },
                    ],
                })
            );

            expect(await bedrockClient.listModels()).toEqual([
                {
                    id: "global.openai.gpt-5.6-terra",
                    name: "global.openai.gpt-5.6-terra",
                    provider: "bedrock",
                },
                { id: "global.openai.gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "bedrock" },
            ]);
        });

        test("returns an empty list when credentials are missing", async () => {
            expect(await bedrockClient.listModels()).toEqual([]);
            expect(bedrockClientConstructionCount).toBe(0);
            expect(mockListInferenceProfiles).not.toHaveBeenCalled();
        });

        test("returns an empty list when discovery fails", async () => {
            configureBedrock();
            mockListInferenceProfiles.mockImplementationOnce(() =>
                Promise.reject(new Error("AccessDeniedException"))
            );

            expect(await bedrockClient.listModels()).toEqual([]);
        });

        test("creates a new control-plane client after refresh", async () => {
            configureBedrock();
            await bedrockClient.listModels();
            expect(bedrockClientConstructionCount).toBe(1);

            bedrockClient.refresh();
            configureBedrock({ bedrock_region: "eu-west-1" });
            await bedrockClient.listModels();

            expect(bedrockClientConstructionCount).toBe(2);
            expect(lastBedrockClientOptions).toEqual({
                region: "eu-west-1",
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key",
                    sessionToken: undefined,
                },
            });
        });
    });

    describe("complete", () => {
        test("sends Converse with the selected model, schema outputConfig, and no SDK retries", async () => {
            configureBedrock();
            const outputSchema = { type: "object", properties: { name: { type: "string" } } };

            await bedrockClient.complete(
                "system prompt",
                "user message",
                "global.openai.gpt-5.6-sol",
                {
                    outputSchema,
                }
            );

            expect(lastRuntimeClientOptions?.maxAttempts).toBe(1);
            expect(converseCommandInputs[0]).toEqual({
                modelId: "global.openai.gpt-5.6-sol",
                messages: [{ role: "user", content: [{ text: "user message" }] }],
                system: [{ text: "system prompt" }],
                inferenceConfig: { maxTokens: 4096 },
                outputConfig: {
                    textFormat: {
                        type: "json_schema",
                        structure: {
                            jsonSchema: {
                                schema: JSON.stringify(outputSchema),
                                name: "relia_prompt_response",
                            },
                        },
                    },
                },
            });
        });

        test("omits outputConfig when no schema is provided", async () => {
            configureBedrock();
            await bedrockClient.complete(
                "system prompt",
                "user message",
                "global.openai.gpt-5.6-luna"
            );

            expect(converseCommandInputs[0]).not.toHaveProperty("outputConfig");
        });

        test("returns the first text block even when it is not first", async () => {
            configureBedrock();
            mockRuntimeSend.mockImplementationOnce(() =>
                Promise.resolve({
                    output: {
                        message: { content: [{ image: {} }, { text: "structured output" }] },
                    },
                    stopReason: "end_turn",
                })
            );

            expect(
                await bedrockClient.complete(
                    "system prompt",
                    "user message",
                    "global.openai.gpt-5.6-luna"
                )
            ).toBe("structured output");
        });
    });
});
