export enum ParseType {
    STRING = "string",
    ARRAY = "array",
    OBJECT = "object",
}

export type ParsedJSON = string | ParsedJSON[] | { [key: string]: ParsedJSON };

function unwrapMarkdownCodeFence(input: string): string {
    const codeFenceMatch = input.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (!codeFenceMatch) {
        return input;
    }
    return codeFenceMatch[1].trim();
}

function isValidParsedJSON(value: unknown): value is ParsedJSON {
    if (typeof value === "string") {
        return true;
    } else if (typeof value === "number") {
        return true;
    } else if (typeof value === "boolean") {
        return true;
    } else if (typeof value === "undefined") {
        return true;
    } else if (Array.isArray(value)) {
        return value.every((item) => !item || isValidParsedJSON(item));
    } else if (typeof value === "object" && value !== null) {
        return Object.values(value).every((val) => !val || isValidParsedJSON(val));
    }
    return false;
}

function matchesParseType(value: unknown, type: ParseType): value is ParsedJSON {
    if (!isValidParsedJSON(value)) return false;

    switch (type) {
        case ParseType.STRING:
            return typeof value === "string";
        case ParseType.ARRAY:
            return Array.isArray(value);
        case ParseType.OBJECT:
            return typeof value === "object" && value !== null && !Array.isArray(value);
        default:
            return false;
    }
}

export function parse(input: string, type: ParseType): ParsedJSON {
    const trimmed = input.trim();

    if (type === ParseType.STRING) {
        try {
            const parsed = JSON.parse(trimmed);
            return typeof parsed === "string" ? parsed : trimmed;
        } catch {
            return trimmed;
        }
    }

    const jsonLikeInput = unwrapMarkdownCodeFence(trimmed);

    try {
        const parsed = JSON.parse(jsonLikeInput);
        if (matchesParseType(parsed, type)) return parsed;
    } catch {
        /* invalid JSON or type mismatch */
    }

    throw new Error("Invalid input");
}
