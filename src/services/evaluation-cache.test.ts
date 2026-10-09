import { describe, test, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { createEvaluationCache } from "./evaluation-cache";

describe("evaluation-cache", () => {
    test("should persist judgements to a file and load them in a new cache", () => {
        const cachePath = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "relia-cache-")),
            "nested",
            "cache.json"
        );
        const judgements = [[], [{ substring: "wrong word", explanation: "Mistranslation" }]];

        const firstCache = createEvaluationCache(cachePath);
        firstCache.judgements.set("key", judgements);
        firstCache.save();

        expect(createEvaluationCache(cachePath).judgements.get("key")).toEqual(judgements);
    });
});
