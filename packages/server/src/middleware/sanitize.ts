import { Request, Response, NextFunction } from "express";

/**
 * Recursively strip HTML tags from all string values in an object.
 * Preserves non-string values and object structure.
 */
function stripHtmlTags(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/<[^>]*>/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(stripHtmlTags);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = stripHtmlTags(val);
    }
    return result;
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body by stripping HTML tags
 * from all string values recursively.
 */
export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = stripHtmlTags(req.body);
  }
  next();
}
