import { test, expect, describe } from "bun:test";
import { parse, ParseType } from "./parse";

describe("parse", () => {
    describe("ParseType.STRING", () => {
        test("should parse valid JSON string", () => {
            const result = parse('"hello world"', ParseType.STRING);
            expect(result).toBe("hello world");
        });

        test("should return plain string when JSON parsing fails", () => {
            const result = parse("hello world", ParseType.STRING);
            expect(result).toBe("hello world");
        });

        test("should trim whitespace and return plain string when JSON parsing fails", () => {
            const result = parse("  hello world  ", ParseType.STRING);
            expect(result).toBe("hello world");
        });

        test("should handle empty string", () => {
            const result = parse("", ParseType.STRING);
            expect(result).toBe("");
        });

        test("should handle whitespace-only string", () => {
            const result = parse("   ", ParseType.STRING);
            expect(result).toBe("");
        });

        test("should handle string with special characters", () => {
            const result = parse('"hello\\nworld\\t!"', ParseType.STRING);
            expect(result).toBe("hello\nworld\t!");
        });

        test("should throw error for non-string JSON (array)", () => {
            expect(() => parse("[1, 2, 3]", ParseType.STRING)).toThrow("Invalid input");
        });

        test("should throw error for non-string JSON (object)", () => {
            expect(() => parse('{"key": "value"}', ParseType.STRING)).toThrow("Invalid input");
        });

        test("should throw error for non-string JSON (number)", () => {
            expect(() => parse("123", ParseType.STRING)).toThrow("Invalid input");
        });

        test("should throw error for non-string JSON (boolean)", () => {
            expect(() => parse("true", ParseType.STRING)).toThrow("Invalid input");
        });

        test("should throw error for non-string JSON (null)", () => {
            expect(() => parse("null", ParseType.STRING)).toThrow("Invalid input");
        });
    });

    describe("ParseType.ARRAY", () => {
        test("should parse valid JSON array of strings", () => {
            const result = parse('["a", "b", "c"]', ParseType.ARRAY);
            expect(result).toEqual(["a", "b", "c"]);
        });

        test("should parse valid JSON array of numbers", () => {
            const result = parse('["1", "2", "3"]', ParseType.ARRAY);
            expect(result).toEqual(["1", "2", "3"]);
        });

        test("should parse nested arrays", () => {
            const result = parse('[["1", "2"], ["3", "4"]]', ParseType.ARRAY);
            expect(result).toEqual([
                ["1", "2"],
                ["3", "4"],
            ]);
        });

        test("should parse array with mixed types", () => {
            const result = parse('["a", "1", {"key": "value"}]', ParseType.ARRAY);
            expect(result).toEqual(["a", "1", { key: "value" }]);
        });

        test("should parse empty array", () => {
            const result = parse("[]", ParseType.ARRAY);
            expect(result).toEqual([]);
        });

        test("should handle whitespace around array", () => {
            const result = parse('  ["1", "2", "3"]  ', ParseType.ARRAY);
            expect(result).toEqual(["1", "2", "3"]);
        });

        test("should throw error for invalid JSON", () => {
            expect(() => parse("[1, 2,", ParseType.ARRAY)).toThrow("Invalid input");
        });

        test("should throw error for non-array JSON (string)", () => {
            expect(() => parse('"hello"', ParseType.ARRAY)).toThrow("Invalid input");
        });

        test("should throw error for non-array JSON (object)", () => {
            expect(() => parse('{"key": "value"}', ParseType.ARRAY)).toThrow("Invalid input");
        });

        test("should throw error for non-array JSON (number)", () => {
            expect(() => parse("123", ParseType.ARRAY)).toThrow("Invalid input");
        });

        test("should throw error for plain string (not JSON)", () => {
            expect(() => parse("hello world", ParseType.ARRAY)).toThrow("Invalid input");
        });

        test("should parse array with nested objects", () => {
            const result = parse('[{"a": "1"}, {"b": "2"}]', ParseType.ARRAY);
            expect(result).toEqual([{ a: "1" }, { b: "2" }]);
        });
    });

    describe("ParseType.OBJECT", () => {
        test("should parse valid JSON object", () => {
            const result = parse('{"key": "value"}', ParseType.OBJECT);
            expect(result).toEqual({ key: "value" });
        });

        test("should parse object with multiple keys", () => {
            const result = parse('{"a": "1", "b": "2", "c": "3"}', ParseType.OBJECT);
            expect(result).toEqual({ a: "1", b: "2", c: "3" });
        });

        test("should parse nested objects", () => {
            const result = parse('{"a": {"b": {"c": "1"}}}', ParseType.OBJECT);
            expect(result).toEqual({ a: { b: { c: "1" } } });
        });

        test("should parse object with array values", () => {
            const result = parse('{"items": ["1", "2", "3"]}', ParseType.OBJECT);
            expect(result).toEqual({ items: ["1", "2", "3"] });
        });

        test("should parse empty object", () => {
            const result = parse("{}", ParseType.OBJECT);
            expect(result).toEqual({});
        });

        test("should handle whitespace around object", () => {
            const result = parse('  {"key": "value"}  ', ParseType.OBJECT);
            expect(result).toEqual({ key: "value" });
        });

        test("should throw error for invalid JSON", () => {
            expect(() => parse('{"key":', ParseType.OBJECT)).toThrow("Invalid input");
        });

        test("should throw error for non-object JSON (string)", () => {
            expect(() => parse('"hello"', ParseType.OBJECT)).toThrow("Invalid input");
        });

        test("should throw error for non-object JSON (array)", () => {
            expect(() => parse("[1, 2, 3]", ParseType.OBJECT)).toThrow("Invalid input");
        });

        test("should throw error for non-object JSON (number)", () => {
            expect(() => parse("123", ParseType.OBJECT)).toThrow("Invalid input");
        });

        test("should throw error for plain string (not JSON)", () => {
            expect(() => parse("hello world", ParseType.OBJECT)).toThrow("Invalid input");
        });

        test("should parse object with mixed value types", () => {
            const result = parse(
                '{"str": "text", "num": "42", "arr": ["1", "2"], "obj": {"nested": "true"}}',
                ParseType.OBJECT
            );
            expect(result).toEqual({
                str: "text",
                num: "42",
                arr: ["1", "2"],
                obj: { nested: "true" },
            });
        });
    });

    describe("edge cases", () => {
        test("should handle newlines and tabs in input", () => {
            const result = parse('\n\t"hello"\n\t', ParseType.STRING);
            expect(result).toBe("hello");
        });

        test("should handle complex nested structures", () => {
            const result = parse('{"a": [{"b": ["1", "2"]}, {"c": "d"}]}', ParseType.OBJECT);
            expect(result).toEqual({ a: [{ b: ["1", "2"] }, { c: "d" }] });
        });

        test("should handle unicode characters", () => {
            const result = parse('"hello 🌍"', ParseType.STRING);
            expect(result).toBe("hello 🌍");
        });

        test("should handle escaped characters in JSON string", () => {
            const result = parse('"hello\\"world"', ParseType.STRING);
            expect(result).toBe('hello"world');
        });
    });
});
