import type { NextFunction, Request, Response } from "express";

/** An error with an HTTP status code that is safe to show to the client. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, msg, details);
export const unauthorized = (msg = "Not authenticated") => new ApiError(401, msg);
export const forbidden = (msg = "You do not have access to this resource") => new ApiError(403, msg);
export const notFound = (msg = "Resource not found") => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);

/** Wraps an async route handler so thrown errors reach the error middleware. */
export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
