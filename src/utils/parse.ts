export enum ParseType {
    STRING = "string",
    ARRAY = "array",
    OBJECT = "object",
}

export type ParsedJSON = string | ParsedJSON[] | { [key: string]: ParsedJSON };

function isValidParsedJSON(value: unknown): value is ParsedJSON {
    if (typeof value === "string") {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every((item) => isValidParsedJSON(item));
    }
    if (typeof value === "object" && value !== null) {
        return Object.values(value).every((val) => isValidParsedJSON(val));
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

    try {
        const parsed = JSON.parse(trimmed);
        if (matchesParseType(parsed, type)) return parsed;
    } catch {
        if (type === ParseType.STRING) return trimmed;
    }
    throw new Error("Invalid input");
}
