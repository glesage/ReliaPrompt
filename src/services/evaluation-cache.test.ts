import { describe, test, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { createEvaluationCache, createEvaluationCacheKey } from "./evaluation-cache";

describe("evaluation-cache", () => {
    test("should persist judgements to a file and load them in a new cache", () => {
        const cachePath = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "relia-cache-")),
            "nested",
            "cache.json"
        );
        const key = createEvaluationCacheKey("judge", "judge-model", "judge prompt", "output");
        const judgements = [[], [{ substring: "wrong word", explanation: "Mistranslation" }]];

        const firstCache = createEvaluationCache(cachePath);
        firstCache.set(key, judgements);
        firstCache.save();

        expect(createEvaluationCache(cachePath).get(key)).toEqual(judgements);
    });

    test("should keep judgements in memory without a file path", () => {
        const cache = createEvaluationCache();
        cache.set("key", [[]]);
        cache.save();

        expect(cache.get("key")).toEqual([[]]);
    });

    test("should change the key when the judge prompt or output changes", () => {
        const key = createEvaluationCacheKey("judge", "judge-model", "judge prompt", "output");

        expect(createEvaluationCacheKey("judge", "judge-model", "other prompt", "output")).not.toBe(
            key
        );
        expect(createEvaluationCacheKey("judge", "judge-model", "judge prompt", "other")).not.toBe(
            key
        );
    });
});
