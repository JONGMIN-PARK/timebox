import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to the global error handler via next(err).
 * Eliminates the need for try/catch in every route.
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
