import { Response } from "express";
import { logger } from "./logger.js";

export const respond = {
  ok: (res: Response, data?: unknown) => {
    res.json({ success: true, data: data ?? null });
  },
  created: (res: Response, data: unknown) => {
    res.status(201).json({ success: true, data });
  },
  error: (res: Response, error: string, status: number = 400) => {
    res.status(status).json({ success: false, error });
  },
  notFound: (res: Response, entity: string = "Resource") => {
    res.status(404).json({ success: false, error: `${entity} not found` });
  },
  forbidden: (res: Response, message: string = "Access denied") => {
    res.status(403).json({ success: false, error: message });
  },
  serverError: (res: Response, context: string, error: unknown) => {
    logger.error(`${context}`, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: `Failed: ${context}` });
  },
};
