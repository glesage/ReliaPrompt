
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const NVM_INC: string;
	export const _ZO_DOCTOR: string;
	export const HOSTNAME: string;
	export const NODE: string;
	export const npm_config_local_prefix: string;
	export const PWD: string;
	export const _: string;
	export const HOME: string;
	export const LANG: string;
	export const CARGO_HOME: string;
	export const npm_package_version: string;
	export const FORCE_COLOR: string;
	export const npm_lifecycle_script: string;
	export const NVM_DIR: string;
	export const CURSOR_AGENT: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const RUSTUP_HOME: string;
	export const USER: string;
	export const GIT_DISCOVERY_ACROSS_FILESYSTEM: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const NVM_CD_FLAGS: string;
	export const npm_config_user_agent: string;
	export const NO_COLOR: string;
	export const npm_execpath: string;
	export const RUST_VERSION: string;
	export const npm_package_json: string;
	export const LC_ALL: string;
	export const PATH: string;
	export const NVM_BIN: string;
	export const npm_node_execpath: string;
	export const OLDPWD: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		NVM_INC: string;
		_ZO_DOCTOR: string;
		HOSTNAME: string;
		NODE: string;
		npm_config_local_prefix: string;
		PWD: string;
		_: string;
		HOME: string;
		LANG: string;
		CARGO_HOME: string;
		npm_package_version: string;
		FORCE_COLOR: string;
		npm_lifecycle_script: string;
		NVM_DIR: string;
		CURSOR_AGENT: string;
		TERM: string;
		npm_package_name: string;
		RUSTUP_HOME: string;
		USER: string;
		GIT_DISCOVERY_ACROSS_FILESYSTEM: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		NVM_CD_FLAGS: string;
		npm_config_user_agent: string;
		NO_COLOR: string;
		npm_execpath: string;
		RUST_VERSION: string;
		npm_package_json: string;
		LC_ALL: string;
		PATH: string;
		NVM_BIN: string;
		npm_node_execpath: string;
		OLDPWD: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
