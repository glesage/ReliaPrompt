import fs from "fs";
import path from "path";
import type { EvaluationIssue } from "./result-types";

/** LLM judge results for identical outputs, with one issue list per judge sample. */
export interface EvaluationCache {
    judgements: Map<string, EvaluationIssue[][]>;
    save(): void;
}

/** Without a file path the cache lives in memory; with one it is loaded from and saved to the file. */
export function createEvaluationCache(filePath?: string): EvaluationCache {
    const judgements = new Map<string, EvaluationIssue[][]>(
        filePath && fs.existsSync(filePath)
            ? Object.entries(JSON.parse(fs.readFileSync(filePath, "utf8")))
            : []
    );

    return {
        judgements,
        save() {
            if (filePath) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(judgements)));
            }
        },
    };
}
