import equal from "fast-deep-equal";
import { type ParsedJSON, ParseType } from "./parse";

type EqualityFn = (a: unknown, b: unknown) => boolean;

function getUniqueValues(arr: unknown[], eq: EqualityFn): unknown[] {
    const unique: unknown[] = [];
    for (const item of arr) {
        if (!unique.some((u) => eq(u, item))) {
            unique.push(item);
        }
    }
    return unique;
}

function existsInArray(value: unknown, arr: unknown[], eq: EqualityFn): boolean {
    return arr.some((item) => eq(item, value));
}

function deepEqualIgnoreArrayOrder(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        const uniqueA = getUniqueValues(a, deepEqualIgnoreArrayOrder);
        const uniqueB = getUniqueValues(b, deepEqualIgnoreArrayOrder);
        if (uniqueA.length !== uniqueB.length) return false;
        return uniqueA.every((item) => existsInArray(item, uniqueB, deepEqualIgnoreArrayOrder));
    }
    if (
        typeof a === "object" &&
        a !== null &&
        !Array.isArray(a) &&
        typeof b === "object" &&
        b !== null &&
        !Array.isArray(b)
    ) {
        const keysA = Object.keys(a as Record<string, unknown>);
        const keysB = Object.keys(b as Record<string, unknown>);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!(key in (b as Record<string, unknown>))) return false;
            if (
                !deepEqualIgnoreArrayOrder(
                    (a as Record<string, unknown>)[key],
                    (b as Record<string, unknown>)[key]
                )
            ) {
                return false;
            }
        }
        return true;
    }
    return equal(a, b);
}

function compareArraysAsSet(
    expected: ParsedJSON[],
    output: ParsedJSON[]
): {
    expectedFound: number;
    expectedTotal: number;
    unexpectedFound: number;
} {
    const uniqueExpected = getUniqueValues(expected, deepEqualIgnoreArrayOrder);
    const uniqueOutput = getUniqueValues(output, deepEqualIgnoreArrayOrder);

    let expectedFound = 0;
    for (const expectedItem of uniqueExpected) {
        if (existsInArray(expectedItem, uniqueOutput, deepEqualIgnoreArrayOrder)) {
            expectedFound++;
        }
    }

    let unexpectedFound = 0;
    for (const outputItem of uniqueOutput) {
        if (!existsInArray(outputItem, uniqueExpected, deepEqualIgnoreArrayOrder)) {
            unexpectedFound++;
        }
    }

    return {
        expectedFound,
        expectedTotal: uniqueExpected.length,
        unexpectedFound,
    };
}

function compareObjects(
    expected: Record<string, ParsedJSON>,
    output: Record<string, ParsedJSON>
): {
    expectedFound: number;
    expectedTotal: number;
    unexpectedFound: number;
} {
    const expectedKeys = Object.keys(expected);
    const outputKeys = Object.keys(output);

    let expectedFound = 0;
    for (const key of expectedKeys) {
        if (key in output && deepEqualIgnoreArrayOrder(expected[key], output[key])) {
            expectedFound++;
        }
    }

    let unexpectedFound = 0;
    for (const key of outputKeys) {
        if (!(key in expected)) {
            unexpectedFound++;
        }
    }

    return {
        expectedFound,
        expectedTotal: expectedKeys.length,
        unexpectedFound,
    };
}

function calculateMetrics(
    expectedType: ParseType,
    expected: ParsedJSON,
    output: ParsedJSON | undefined
): {
    expectedFound: number;
    expectedTotal: number;
    unexpectedFound: number;
} {
    if (expectedType === ParseType.ARRAY && Array.isArray(expected)) {
        if (Array.isArray(output)) {
            return compareArraysAsSet(expected, output);
        } else {
            return { expectedFound: 0, expectedTotal: expected.length, unexpectedFound: 0 };
        }
    }

    if (expectedType === ParseType.OBJECT && typeof expected === "object") {
        if (typeof output === "object") {
            return compareObjects(
                expected as Record<string, ParsedJSON>,
                output as Record<string, ParsedJSON>
            );
        } else {
            return {
                expectedFound: 0,
                expectedTotal: Object.keys(expected).length,
                unexpectedFound: 0,
            };
        }
    }

    if (expectedType === ParseType.STRING && typeof expected === "string") {
        if (typeof output === "string" && equal(expected, output)) {
            return { expectedFound: 1, expectedTotal: 1, unexpectedFound: 0 };
        }
        return { expectedFound: 0, expectedTotal: 1, unexpectedFound: 0 };
    }

    return { expectedFound: 0, expectedTotal: 0, unexpectedFound: 0 };
}

export function compare(
    expected: ParsedJSON,
    output: ParsedJSON,
    expectedType: ParseType
): {
    score: number;
    expectedTotal: number;
    expectedFound: number;
    unexpectedFound: number;
} {
    if (expected === undefined) {
        throw new Error("Expected value is undefined");
    }

    const metrics = calculateMetrics(expectedType, expected, output);

    let score: number;
    if (metrics.expectedTotal === 0) {
        score = metrics.unexpectedFound === 0 ? 1 : 0;
    } else {
        score = (metrics.expectedFound - metrics.unexpectedFound) / metrics.expectedTotal;
    }

    return {
        score: score < 0 ? 0 : score,
        expectedTotal: metrics.expectedTotal,
        expectedFound: metrics.expectedFound,
        unexpectedFound: metrics.unexpectedFound,
    };
}
