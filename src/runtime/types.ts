/**
 * Provider-specific credentials for library initialization.
 * Keys match the config keys used by LLM clients (e.g. openai_api_key).
 */
export interface ProviderCredentials {
    openai_api_key?: string;
    bedrock_access_key_id?: string;
    bedrock_secret_access_key?: string;
    bedrock_session_token?: string;
    bedrock_region?: string;
    cerebras_api_key?: string;
    deepseek_api_key?: string;
    gemini_api_key?: string;
    groq_api_key?: string;
    openrouter_api_key?: string;
    [key: string]: string | undefined;
}

/**
 * Options for initializing reliaprompt in library mode.
 * Pass provider credentials so the library can call LLMs.
 */
export interface ReliaPromptInitOptions {
    /**
     * Provider API keys and optional settings.
     * Used when running tests in process (e.g. unit tests or reliaprompt:ui).
     */
    providers?: ProviderCredentials;
}
