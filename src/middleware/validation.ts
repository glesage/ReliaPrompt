import { Request, Response, NextFunction } from "express";

/**
 * Validation middleware that runs a validator on the request body.
 * On success, assigns the validated value to req.body and calls next().
 * On throw, returns 400 with { error: "Validation error: <message>" }.
 */
export function validateBody<T>(validator: (data: unknown) => T) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const value = validator(req.body);
            req.body = value;
            next();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return res.status(400).json({
                error: `Validation error: ${message}`,
            });
        }
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
