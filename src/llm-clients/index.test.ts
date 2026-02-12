import { describe, test, expect, beforeEach } from "bun:test";
import { clearConfigOverlay, setConfigOverlay } from "../runtime/config";
import { getClient, getConfiguredClients, refreshClients, openaiClient, groqClient } from "./index";

describe("llm-clients registry", () => {
    beforeEach(() => {
        clearConfigOverlay();
        refreshClients();
    });

    describe("getClient", () => {
        test("resolves by provider id (lowercase)", () => {
            expect(getClient("openai")).toBe(openaiClient);
            expect(getClient("groq")).toBe(groqClient);
        });

        test("resolves by provider id alias", () => {
            expect(getClient("openai")).toBe(openaiClient);
            expect(getClient("groq")).toBe(groqClient);
        });

        test("returns undefined for unknown provider", () => {
            expect(getClient("unknown")).toBeUndefined();
        });
    });

    describe("getConfiguredClients / refreshClients", () => {
        test("no clients configured when overlay is empty", () => {
            setConfigOverlay(null);
            refreshClients();
            expect(getConfiguredClients()).toHaveLength(0);
        });

        test("configured clients after overlay set", () => {
            setConfigOverlay({
                openai_api_key: "sk-test",
                groq_api_key: "gsk-test",
            });
            refreshClients();
            const configured = getConfiguredClients();
            expect(configured.length).toBeGreaterThanOrEqual(2);
            const providerIds = configured.map((c) => c.providerId);
            expect(providerIds).toContain("openai");
            expect(providerIds).toContain("groq");
        });

        test("refresh clears cached state so client re-reads config", () => {
            setConfigOverlay({ openai_api_key: "sk-first" });
            refreshClients();
            expect(openaiClient.isConfigured()).toBe(true);

            setConfigOverlay(null);
            refreshClients();
            expect(openaiClient.isConfigured()).toBe(false);
        });
    });
});
