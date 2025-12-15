import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "../errors";

/**
 * Validation middleware factory that validates request data using Joi schemas
 * @param schema - Joi schema to validate against
 * @param source - Where to get the data from: 'body', 'params', or 'query'
 */
export function validate(
    schema: Joi.ObjectSchema | Joi.ArraySchema,
    source: "body" | "params" | "query" = "body"
) {
    return (req: Request, res: Response, next: NextFunction) => {
        const data = source === "body" ? req.body : source === "params" ? req.params : req.query;

        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });

        if (error) {
            const errorMessages = error.details.map((detail) => detail.message).join(", ");
            return res.status(400).json({
                error: `Validation error: ${errorMessages}`,
            });
        }

        // Replace the original data with validated and sanitized data
        if (source === "body") {
            req.body = value;
        } else if (source === "params") {
            req.params = value;
        } else {
            req.query = value;
        }

        next();
    };
}

/**
 * Helper to validate integer ID parameters
 */
export function validateIdParam(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id;
    if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({
            error: "Validation error: id must be a valid integer",
        });
    }
    next();
}

