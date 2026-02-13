import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
    RELIA_PROMPT_LLM_CONFIG_JSON,
    getCredentialsFromJsonEnv,
    setConfigOverlay,
    clearConfigOverlay,
    getConfig,
} from "./config";

describe("runtime config", () => {
    const originalEnv = process.env[RELIA_PROMPT_LLM_CONFIG_JSON];

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = originalEnv;
        } else {
            delete process.env[RELIA_PROMPT_LLM_CONFIG_JSON];
        }
        clearConfigOverlay();
    });

    describe("getCredentialsFromJsonEnv", () => {
        test("returns empty object when env var is missing", () => {
            delete process.env[RELIA_PROMPT_LLM_CONFIG_JSON];
            expect(getCredentialsFromJsonEnv()).toEqual({});
        });

        test("returns empty object when env var is empty string", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = "";
            expect(getCredentialsFromJsonEnv()).toEqual({});
        });

        test("returns empty object when env var is whitespace", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = "   ";
            expect(getCredentialsFromJsonEnv()).toEqual({});
        });

        test("parses valid nested JSON and maps to canonical keys", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                openai: { apiKey: "sk-foo" },
                groq: { apiKey: "gsk-bar" },
            });
            const creds = getCredentialsFromJsonEnv();
            expect(creds.openai_api_key).toBe("sk-foo");
            expect(creds.groq_api_key).toBe("gsk-bar");
        });

        test("parses JSON when env loader keeps surrounding single quotes", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = '\'{"openai":{"apiKey":"sk-foo"}}\'';
            const creds = getCredentialsFromJsonEnv();
            expect(creds.openai_api_key).toBe("sk-foo");
        });

        test("parses JSON when env loader keeps surrounding double quotes", () => {
            const payload = '{"openai":{"apiKey":"sk-foo"}}';
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = `"${payload}"`;
            const creds = getCredentialsFromJsonEnv();
            expect(creds.openai_api_key).toBe("sk-foo");
        });

        test("parses bedrock nested config", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                bedrock: {
                    accessKeyId: "AKIAXXX",
                    secretAccessKey: "secret",
                    sessionToken: "token",
                    region: "us-east-1",
                },
            });
            const creds = getCredentialsFromJsonEnv();
            expect(creds.bedrock_access_key_id).toBe("AKIAXXX");
            expect(creds.bedrock_secret_access_key).toBe("secret");
            expect(creds.bedrock_session_token).toBe("token");
            expect(creds.bedrock_region).toBe("us-east-1");
        });

        test("coerces number and boolean to string", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                openai: { apiKey: 12345 },
            });
            const creds = getCredentialsFromJsonEnv();
            expect(creds.openai_api_key).toBe("12345");
        });

        test("throws on malformed JSON", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = "{ invalid";
            expect(() => getCredentialsFromJsonEnv()).toThrow(
                /Invalid RELIA_PROMPT_LLM_CONFIG_JSON: not valid JSON/
            );
        });

        test("throws when root is not an object", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = "[]";
            expect(() => getCredentialsFromJsonEnv()).toThrow(
                /must be a JSON object keyed by provider id/
            );
        });

        test("throws on unknown provider id", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                unknown_provider: { apiKey: "x" },
            });
            expect(() => getCredentialsFromJsonEnv()).toThrow(/Unknown provider.*unknown_provider/);
        });

        test("throws when provider value is not an object", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                openai: "not-an-object",
            });
            expect(() => getCredentialsFromJsonEnv()).toThrow(/"openai" must be an object/);
        });

        test("throws when nested value is object or array", () => {
            process.env[RELIA_PROMPT_LLM_CONFIG_JSON] = JSON.stringify({
                openai: { apiKey: { nested: true } },
            });
            expect(() => getCredentialsFromJsonEnv()).toThrow(
                /openai\.apiKey.*strings, numbers, or booleans/
            );
        });
    });

    describe("setConfigOverlay / getConfig", () => {
        beforeEach(() => {
            clearConfigOverlay();
        });

        test("getConfig returns null when overlay is not set", () => {
            expect(getConfig("openai_api_key")).toBeNull();
        });

        test("getConfig returns value from overlay", () => {
            setConfigOverlay({ openai_api_key: "sk-test" });
            expect(getConfig("openai_api_key")).toBe("sk-test");
        });

        test("clearConfigOverlay clears overlay", () => {
            setConfigOverlay({ openai_api_key: "sk-test" });
            clearConfigOverlay();
            expect(getConfig("openai_api_key")).toBeNull();
        });
    });
});
