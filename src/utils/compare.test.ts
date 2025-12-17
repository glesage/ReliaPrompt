import { test, expect, describe } from "bun:test";
import { compare, ComparisonResult } from "./compare";
import { ParseType } from "./parse";

describe("compare", () => {
    describe("ParseType.STRING", () => {
        test("should return perfect score for exact match", () => {
            const result = compare("hello", "hello", ParseType.STRING);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 0,
            });
        });

        test("should return zero score for mismatch", () => {
            const result = compare("hello", "world", ParseType.STRING);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 1,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should return zero score for undefined output", () => {
            const result = compare("hello", undefined, ParseType.STRING);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 1,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should throw error for undefined expected", () => {
            expect(() => {
                compare(undefined, "hello", ParseType.STRING);
            }).toThrow("Expected value is undefined");
        });

        test("should handle empty strings", () => {
            const result = compare("", "", ParseType.STRING);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 0,
            });
        });

        test("should handle strings with special characters", () => {
            const result = compare("hello\nworld", "hello\nworld", ParseType.STRING);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 0,
            });
        });
    });

    describe("ParseType.ARRAY", () => {
        test("should return perfect score for exact match", () => {
            const result = compare([1, 2, 3], [1, 2, 3], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 3,
                expectedFound: 3,
                unexpectedFound: 0,
            });
        });

        test("should return perfect score for exact match with different order", () => {
            const result = compare([1, 2, 3], [3, 1, 2], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 3,
                expectedFound: 3,
                unexpectedFound: 0,
            });
        });

        test("should handle duplicates in expected (set comparison)", () => {
            const result = compare([1, 1, 2, 2], [1, 2], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2, // unique values: 1, 2
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should handle duplicates in output", () => {
            const result = compare([1, 2], [1, 1, 2, 2], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should return partial score for partial match", () => {
            const result = compare([1, 2, 3], [1, 2], ParseType.ARRAY);
            expect(result).toEqual({
                score: 2 / 3,
                expectedTotal: 3,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should count unexpected items", () => {
            const result = compare([1, 2], [1, 2, 3, 4], ParseType.ARRAY);
            expect(result).toEqual({
                score: 0, // (2 - 2) / 2 = 0
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 2, // 3 and 4 are unexpected
            });
        });

        test("should return zero score for no matches", () => {
            const result = compare([1, 2, 3], [4, 5, 6], ParseType.ARRAY);
            expect(result).toEqual({
                score: 0, // (0 - 3) / 3 = -1, clamped to 0
                expectedTotal: 3,
                expectedFound: 0,
                unexpectedFound: 3,
            });
        });

        test("should return zero score for undefined output", () => {
            const result = compare([1, 2, 3], undefined, ParseType.ARRAY);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 3,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should return zero score for non-array output", () => {
            const result = compare([1, 2, 3], "not an array" as any, ParseType.ARRAY);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 3,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should handle empty arrays", () => {
            const result = compare([], [], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1, // Empty arrays are equal
                expectedTotal: 0,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should handle empty expected array with non-empty output", () => {
            const result = compare([], [1, 2], ParseType.ARRAY);
            expect(result).toEqual({
                score: 0, // 0/1 = 0 (division by zero protection uses 1 as denominator)
                expectedTotal: 0,
                expectedFound: 0,
                unexpectedFound: 2,
            });
        });

        test("should handle nested arrays", () => {
            const result = compare(
                [
                    [1, 2],
                    [3, 4],
                ],
                [
                    [1, 2],
                    [3, 4],
                ],
                ParseType.ARRAY
            );
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should handle arrays with objects", () => {
            const result = compare([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }], ParseType.ARRAY);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should handle arrays with mixed types", () => {
            const result = compare(
                ["a", 1, { key: "value" }],
                ["a", 1, { key: "value" }],
                ParseType.ARRAY
            );
            expect(result).toEqual({
                score: 1,
                expectedTotal: 3,
                expectedFound: 3,
                unexpectedFound: 0,
            });
        });

        test("should handle partial match with unexpected items", () => {
            const result = compare([1, 2, 3], [1, 2, 4, 5], ParseType.ARRAY);
            expect(result).toEqual({
                score: 0, // (2 - 2) / 3 = 0
                expectedTotal: 3,
                expectedFound: 2,
                unexpectedFound: 2, // 4 and 5
            });
        });
    });

    describe("ParseType.OBJECT", () => {
        test("should return perfect score for exact match", () => {
            const result = compare({ a: 1, b: 2 }, { a: 1, b: 2 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should return perfect score with different key order", () => {
            const result = compare({ a: 1, b: 2 }, { b: 2, a: 1 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should return partial score for partial match", () => {
            const result = compare({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 2 / 3,
                expectedTotal: 3,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should return zero score for key with wrong value", () => {
            const result = compare({ a: 1, b: 2 }, { a: 1, b: 3 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1 / 2,
                expectedTotal: 2,
                expectedFound: 1, // only 'a' matches
                unexpectedFound: 0,
            });
        });

        test("should count extra keys as unexpected", () => {
            const result = compare({ a: 1 }, { a: 1, b: 2, c: 3 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0, // (1 - 2) / 1 = -1, clamped to 0
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 2, // 'b' and 'c' are unexpected
            });
        });

        test("should return zero score for no matching keys", () => {
            const result = compare({ a: 1, b: 2 }, { c: 3, d: 4 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0, // (0 - 2) / 2 = -1, clamped to 0
                expectedTotal: 2,
                expectedFound: 0,
                unexpectedFound: 2,
            });
        });

        test("should return zero score for undefined output", () => {
            const result = compare({ a: 1, b: 2 }, undefined, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 2,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should return zero score for non-object output", () => {
            const result = compare({ a: 1 }, "not an object" as any, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0,
                expectedTotal: 1,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should handle empty objects", () => {
            const result = compare({}, {}, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1, // Empty objects are equal
                expectedTotal: 0,
                expectedFound: 0,
                unexpectedFound: 0,
            });
        });

        test("should handle empty expected object with non-empty output", () => {
            const result = compare({}, { a: 1, b: 2 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0, // 0/1 = 0 (division by zero protection uses 1 as denominator)
                expectedTotal: 0,
                expectedFound: 0,
                unexpectedFound: 2,
            });
        });

        test("should handle nested objects", () => {
            const result = compare(
                { a: { b: { c: 1 } } },
                { a: { b: { c: 1 } } },
                ParseType.OBJECT
            );
            expect(result).toEqual({
                score: 1,
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 0,
            });
        });

        test("should handle objects with array values", () => {
            const result = compare({ items: [1, 2, 3] }, { items: [1, 2, 3] }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 1,
                expectedFound: 1,
                unexpectedFound: 0,
            });
        });

        test("should handle objects with mixed value types", () => {
            const result = compare(
                { str: "text", num: 42, arr: [1, 2], obj: { nested: true } },
                { str: "text", num: 42, arr: [1, 2], obj: { nested: true } },
                ParseType.OBJECT
            );
            expect(result).toEqual({
                score: 1,
                expectedTotal: 4,
                expectedFound: 4,
                unexpectedFound: 0,
            });
        });

        test("should handle partial match with extra keys", () => {
            const result = compare({ a: 1, b: 2 }, { a: 1, b: 2, c: 3, d: 4 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0, // (2 - 2) / 2 = 0
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 2, // 'c' and 'd'
            });
        });

        test("should handle missing keys and wrong values", () => {
            const result = compare({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, d: 4 }, ParseType.OBJECT);
            expect(result).toEqual({
                score: 0, // (1 - 1) / 3 = 0
                expectedTotal: 3,
                expectedFound: 1,
                unexpectedFound: 1, // 'd' is unexpected
            });
        });
    });

    describe("edge cases", () => {
        test("should handle division by zero for empty expected (array)", () => {
            const result = compare([], [1, 2], ParseType.ARRAY);
            // Score should be 0 (0/1 = 0 due to division by zero protection using 1 as denominator)
            expect(result.score).toBe(0);
            expect(result.expectedTotal).toBe(0);
        });

        test("should handle division by zero for empty expected (object)", () => {
            const result = compare({}, { a: 1 }, ParseType.OBJECT);
            // Score should be 0 (0/1 = 0 due to division by zero protection using 1 as denominator)
            expect(result.score).toBe(0);
            expect(result.expectedTotal).toBe(0);
        });

        test("should throw error when expected is undefined", () => {
            expect(() => compare(undefined, "anything", ParseType.STRING)).toThrow(
                "Expected value is undefined"
            );
            expect(() => compare(undefined, [], ParseType.ARRAY)).toThrow(
                "Expected value is undefined"
            );
            expect(() => compare(undefined, {}, ParseType.OBJECT)).toThrow(
                "Expected value is undefined"
            );
        });

        test("should handle complex nested structures", () => {
            const expected = {
                users: [
                    { id: 1, name: "Alice" },
                    { id: 2, name: "Bob" },
                ],
                metadata: { count: 2 },
            };
            const output = {
                users: [
                    { id: 1, name: "Alice" },
                    { id: 2, name: "Bob" },
                ],
                metadata: { count: 2 },
            };
            const result = compare(expected, output, ParseType.OBJECT);
            expect(result).toEqual({
                score: 1,
                expectedTotal: 2,
                expectedFound: 2,
                unexpectedFound: 0,
            });
        });

        test("should handle score calculation with floating point precision", () => {
            const result = compare([1, 2, 3, 4, 5], [1, 2], ParseType.ARRAY);
            expect(result.score).toBeCloseTo(0.4, 10); // (2 - 0) / 5 = 0.4 (no unexpected items)
            expect(result.expectedTotal).toBe(5);
            expect(result.expectedFound).toBe(2);
        });
    });
});
