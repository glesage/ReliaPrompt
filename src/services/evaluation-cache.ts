import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { EvaluationIssue } from "./result-types";

/**
 * Stores LLM judge results so identical outputs reuse the same judgements across runs and
 * prompt versions. Each entry holds one issue list per judge sample.
 */
export interface EvaluationCache {
    get(key: string): EvaluationIssue[][] | undefined;
    set(key: string, judgements: EvaluationIssue[][]): void;
    /** Persists the cache when it is backed by a file. */
    save(): void;
}

/**
 * The key covers the judge model, the full judge prompt, and the output, so changing the
 * judge, its criteria, task, or input starts a new entry.
 */
export function createEvaluationCacheKey(
    judgeProviderId: string,
    judgeModelId: string,
    judgePrompt: string,
    actualOutput: string
): string {
    return createHash("sha256")
        .update(JSON.stringify([judgeProviderId, judgeModelId, judgePrompt, actualOutput]))
        .digest("hex");
}

function isEvaluationIssueList(value: unknown): value is EvaluationIssue[] {
    return (
        Array.isArray(value) &&
        value.every(
            (issue) =>
                issue !== null &&
                typeof issue === "object" &&
                "substring" in issue &&
                typeof issue.substring === "string" &&
                "explanation" in issue &&
                typeof issue.explanation === "string"
        )
    );
}

function readCacheFile(filePath: string): Map<string, EvaluationIssue[][]> {
    const entries = new Map<string, EvaluationIssue[][]>();
    if (!fs.existsSync(filePath)) {
        return entries;
    }

    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Evaluation cache file ${filePath} must contain a JSON object`);
    }

    for (const [key, judgements] of Object.entries(parsed)) {
        if (Array.isArray(judgements) && judgements.every(isEvaluationIssueList)) {
            entries.set(key, judgements);
        }
    }
    return entries;
}

/**
 * Creates an evaluation cache. Without a file path it lives in memory; with one it loads
 * existing judgements from the file and writes them back on save().
 */
export function createEvaluationCache(filePath?: string): EvaluationCache {
    const entries = filePath ? readCacheFile(filePath) : new Map<string, EvaluationIssue[][]>();

    return {
        get: (key) => entries.get(key),
        set: (key, judgements) => {
            entries.set(key, judgements);
        },
        save: () => {
            if (!filePath) {
                return;
            }
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(entries)));
        },
    };
}
