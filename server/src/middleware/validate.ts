import type { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { badRequest } from "../lib/errors";

type Schemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Validates and normalises request input using zod schemas.
 * On failure responds 400 with a list of field errors.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, "query", { value: parsed, configurable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      const anyErr = err as { issues?: { path: (string | number)[]; message: string }[] };
      if (anyErr.issues) {
        next(
          badRequest(
            "Validation failed",
            anyErr.issues.map((i) => ({ field: i.path.join(".") || "(root)", message: i.message })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
