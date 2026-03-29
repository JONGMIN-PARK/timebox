import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Global Express error handler.
 * Catches all errors forwarded by asyncHandler or next(err).
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    // Operational errors: log at warn level (expected failures)
    logger.warn(err.message, {
      statusCode: err.statusCode,
      method: req.method,
      path: req.originalUrl,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Unexpected errors: log full details at error level
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
