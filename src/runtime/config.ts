import fs from "fs";
import path from "path";

import { getProviderById, type LLMConfigKey } from "../../shared/providers";
import type { ProviderCredentials } from "./types";

export const RELIA_PROMPT_LLM_CONFIG_JSON = "RELIA_PROMPT_LLM_CONFIG_JSON";

let configOverlay: ProviderCredentials | null = null;

export function loadEnvFile(fromDir: string): void {
    const envPath = path.join(fromDir, ".env");
    if (!fs.existsSync(envPath)) return;
    try {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1];
                if (process.env[key] != null) continue;
                const value = match[2].replace(/^\s*["']|["']\s*$/g, "").trim();
                process.env[key] = value;
            }
        }
    } catch {
        return;
    }
}

function stringifyConfigValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    throw new Error("LLM config values must be strings, numbers, or booleans; got " + typeof value);
}

export function getCredentialsFromJsonEnv(): ProviderCredentials {
    const raw = process.env[RELIA_PROMPT_LLM_CONFIG_JSON];
    if (raw == null || String(raw).trim() === "") {
        return {};
    }

    // Handle env loaders that keep surrounding quotes.
    let normalizedRaw = String(raw).trim();
    const startsWithSingleQuote = normalizedRaw.startsWith("'");
    const endsWithSingleQuote = normalizedRaw.endsWith("'");
    const startsWithDoubleQuote = normalizedRaw.startsWith('"');
    const endsWithDoubleQuote = normalizedRaw.endsWith('"');
    if (
        (startsWithSingleQuote && endsWithSingleQuote) ||
        (startsWithDoubleQuote && endsWithDoubleQuote)
    ) {
        normalizedRaw = normalizedRaw.slice(1, -1).trim();
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(normalizedRaw) as Record<string, unknown>;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Invalid ${RELIA_PROMPT_LLM_CONFIG_JSON}: not valid JSON. ${message}`);
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(
            `Invalid ${RELIA_PROMPT_LLM_CONFIG_JSON}: must be a JSON object keyed by provider id.`
        );
    }

    const out: ProviderCredentials = {};
    const parsedObj = parsed as Record<string, unknown>;
    const providerIds = Object.keys(parsedObj);

    for (const providerId of providerIds) {
        const provider = getProviderById(providerId);
        if (!provider) {
            throw new Error(
                `Unknown provider in ${RELIA_PROMPT_LLM_CONFIG_JSON}: "${providerId}". ` +
                    "Valid provider ids: openai, bedrock, cerebras, deepseek, gemini, groq, openrouter."
            );
        }

        const block = parsedObj[providerId];
        if (block === null || typeof block !== "object" || Array.isArray(block)) {
            throw new Error(
                `Invalid ${RELIA_PROMPT_LLM_CONFIG_JSON}: "${providerId}" must be an object.`
            );
        }

        const blockObj = block as Record<string, unknown>;
        for (const [jsonKey, canonicalKey] of Object.entries(provider.jsonFieldMap)) {
            const value = blockObj[jsonKey];
            if (value === undefined) continue;
            try {
                const str = stringifyConfigValue(value);
                if (str) (out as Record<string, string>)[canonicalKey as LLMConfigKey] = str;
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                throw new Error(
                    `Invalid ${RELIA_PROMPT_LLM_CONFIG_JSON}: "${providerId}.${jsonKey}" - ${message}`
                );
            }
        }
    }

    return out;
}

export function getCredentialsFromEnv(): ProviderCredentials {
    return getCredentialsFromJsonEnv();
}

export function setConfigOverlay(overlay: ProviderCredentials | null): void {
    configOverlay = overlay ? { ...overlay } : null;
}

export function getConfig(key: string): string | null {
    if (configOverlay === null) return null;
    const value = configOverlay[key];
    return value != null ? String(value) : null;
}

export function clearConfigOverlay(): void {
    configOverlay = null;
}
