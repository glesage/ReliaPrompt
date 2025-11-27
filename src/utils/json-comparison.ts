import equal from "fast-deep-equal";

export interface ComparisonResult {
    isEqual: boolean;
    error?: string;
    expectedParsed?: unknown;
    actualParsed?: unknown;
}

export function parseJSON(input: string): { success: boolean; value?: unknown; error?: string } {
    if (input === undefined || input === null) {
        return { success: false, error: "Input is null or undefined" };
    }

    const trimmed = input.trim();

    if (trimmed === "") {
        return { success: false, error: "Input is empty" };
    }

    try {
        const parsed = JSON.parse(trimmed);
        return { success: true, value: parsed };
    } catch (e) {
        const errors: string[] = [`Direct parse failed: ${(e as Error).message}`];

        const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            try {
                const parsed = JSON.parse(codeBlockMatch[1].trim());
                return { success: true, value: parsed };
            } catch (codeBlockError) {
                errors.push(`Code block extraction failed: ${(codeBlockError as Error).message}`);
            }
        }

        const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return { success: true, value: parsed };
            } catch (jsonMatchError) {
                errors.push(`JSON extraction failed: ${(jsonMatchError as Error).message}`);
            }
        }

        return { success: false, error: `Invalid JSON - ${errors.join("; ")}` };
    }
}

export function compareJSON(expected: string, actual: string): ComparisonResult {
    const expectedResult = parseJSON(expected);
    if (!expectedResult.success) {
        return {
            isEqual: false,
            error: `Failed to parse expected: ${expectedResult.error}`,
        };
    }

    const actualResult = parseJSON(actual);
    if (!actualResult.success) {
        return {
            isEqual: false,
            error: `Failed to parse actual: ${actualResult.error}`,
            expectedParsed: expectedResult.value,
        };
    }

    const isEqual = equal(expectedResult.value, actualResult.value);

    return {
        isEqual,
        expectedParsed: expectedResult.value,
        actualParsed: actualResult.value,
        error: isEqual ? undefined : "Values do not match",
    };
}

export function looksLikeJSON(input: string): boolean {
    const trimmed = input.trim();
    return (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        trimmed === "true" ||
        trimmed === "false" ||
        trimmed === "null" ||
        /^-?\d+(\.\d+)?$/.test(trimmed) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
    );
}
