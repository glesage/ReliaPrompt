const unsupportedStrictSchemaKeywords = new Set([
    "$schema",
    "default",
    "description",
    "examples",
    "format",
    "maxItems",
    "minItems",
    "pattern",
    "title",
]);

export function toCerebrasStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
    return removeUnsupportedStrictSchemaKeywords(schema) as Record<string, unknown>;
}

function removeUnsupportedStrictSchemaKeywords(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(removeUnsupportedStrictSchemaKeywords);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !unsupportedStrictSchemaKeywords.has(key))
            .map(([key, nestedValue]) => [key, removeUnsupportedStrictSchemaKeywords(nestedValue)])
    );
}
