import { describe, expect, test } from "bun:test";
import { toCerebrasStrictSchema } from "./cerebras-client";

describe("toCerebrasStrictSchema", () => {
    test("removes keywords unsupported by Cerebras strict structured output", () => {
        expect(
            toCerebrasStrictSchema({
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                description: "Response",
                properties: {
                    dates: {
                        type: "array",
                        minItems: 1,
                        maxItems: 2,
                        items: { type: "string", format: "date", pattern: "^\\d+$" },
                    },
                },
            })
        ).toEqual({
            type: "object",
            properties: {
                dates: {
                    type: "array",
                    items: { type: "string" },
                },
            },
        });
    });
});
