/**
 * Canonical provider metadata: config keys, env hints, and display names.
 * Single source of truth for backend config, validation schemas, and dashboard UI.
 */

export const LLM_CONFIG_KEYS = [
    "openai_api_key",
    "bedrock_access_key_id",
    "bedrock_secret_access_key",
    "bedrock_session_token",
    "bedrock_region",
    "cerebras_api_key",
    "deepseek_api_key",
    "gemini_api_key",
    "groq_api_key",
    "openrouter_api_key",
] as const;

export type LLMConfigKey = (typeof LLM_CONFIG_KEYS)[number];

/** Env var names we accept per config key (first match wins when reading .env). */
export const ENV_ALIASES: Record<LLMConfigKey, string[]> = {
    openai_api_key: ["OPENAI_API_KEY"],
    bedrock_access_key_id: ["AWS_ACCESS_KEY_ID"],
    bedrock_secret_access_key: ["AWS_SECRET_ACCESS_KEY"],
    bedrock_session_token: ["AWS_SESSION_TOKEN"],
    bedrock_region: ["AWS_REGION", "BEDROCK_REGION"],
    cerebras_api_key: ["CEREBRAS_API_KEY"],
    deepseek_api_key: ["DEEPSEEK_API_KEY"],
    gemini_api_key: ["GEMINI_API_KEY"],
    groq_api_key: ["GROQ_API_KEY"],
    openrouter_api_key: ["OPENROUTER_API_KEY", "OPEN_ROUTER_API_KEY"],
};

/**
 * Maps nested JSON config field names (e.g. "apiKey") to canonical LLM config keys (e.g. "openai_api_key").
 * Used when parsing RELIA_PROMPT_LLM_CONFIG_JSON.
 */
export type JsonFieldMap = Record<string, LLMConfigKey>;

export interface ProviderMeta {
    id: string;
    displayName: string;
    /** Keys that must be set for the provider to be considered configured. */
    configKeys: readonly LLMConfigKey[];
    /** Human-readable env hint for the UI (e.g. "OPENAI_API_KEY" or "AWS_ACCESS_KEY_ID, ..."). */
    envHint: string;
    /** Nested JSON key -> canonical config key for RELIA_PROMPT_LLM_CONFIG_JSON parsing. */
    jsonFieldMap: JsonFieldMap;
}

export const PROVIDERS: ProviderMeta[] = [
    {
        id: "openai",
        displayName: "openai",
        configKeys: ["openai_api_key"],
        envHint: "OPENAI_API_KEY",
        jsonFieldMap: { apiKey: "openai_api_key" },
    },
    {
        id: "bedrock",
        displayName: "bedrock",
        configKeys: ["bedrock_access_key_id", "bedrock_secret_access_key"],
        envHint: "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION",
        jsonFieldMap: {
            accessKeyId: "bedrock_access_key_id",
            secretAccessKey: "bedrock_secret_access_key",
            sessionToken: "bedrock_session_token",
            region: "bedrock_region",
        },
    },
    {
        id: "cerebras",
        displayName: "cerebras",
        configKeys: ["cerebras_api_key"],
        envHint: "CEREBRAS_API_KEY",
        jsonFieldMap: { apiKey: "cerebras_api_key" },
    },
    {
        id: "deepseek",
        displayName: "deepseek",
        configKeys: ["deepseek_api_key"],
        envHint: "DEEPSEEK_API_KEY",
        jsonFieldMap: { apiKey: "deepseek_api_key" },
    },
    {
        id: "gemini",
        displayName: "gemini",
        configKeys: ["gemini_api_key"],
        envHint: "GEMINI_API_KEY",
        jsonFieldMap: { apiKey: "gemini_api_key" },
    },
    {
        id: "groq",
        displayName: "groq",
        configKeys: ["groq_api_key"],
        envHint: "GROQ_API_KEY",
        jsonFieldMap: { apiKey: "groq_api_key" },
    },
    {
        id: "openrouter",
        displayName: "openrouter",
        configKeys: ["openrouter_api_key"],
        envHint: "OPENROUTER_API_KEY",
        jsonFieldMap: { apiKey: "openrouter_api_key" },
    },
];

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));
const byDisplayName = new Map(PROVIDERS.map((p) => [p.displayName, p]));

export function getProviderById(id: string): ProviderMeta | undefined {
    return byId.get(id);
}

export function getProviderByDisplayName(displayName: string): ProviderMeta | undefined {
    return byDisplayName.get(displayName);
}

/** Accepts config objects with optional string values for provider keys (e.g. LLMConfig). */
export function isProviderConfigured(
    config: Partial<Record<LLMConfigKey, string>>,
    providerIdOrDisplayName: string
): boolean {
    const provider = byId.get(providerIdOrDisplayName) ?? byDisplayName.get(providerIdOrDisplayName);
    if (!provider) return false;
    return provider.configKeys.every((key) => {
        const v = config[key];
        return v != null && String(v).trim().length > 0;
    });
}

/** Env hints keyed by provider id for the config modal. */
export const ENV_HINTS_BY_ID: Record<string, string> = Object.fromEntries(
    PROVIDERS.map((p) => [p.id, p.envHint])
);
