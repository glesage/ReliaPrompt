import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: true,
            },
        },
        rules: {
            // TypeScript-specific rules
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            // General rules
            "no-console": "off", // Allow console.log for debugging
        },
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
            },
        },
        rules: {
            "@typescript-eslint/no-var-requires": "off",
        },
    },
    {
        ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.mjs"],
    }
);
