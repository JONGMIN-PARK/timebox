import { z } from "zod";
import { Request, Response, NextFunction } from "express";

// Reusable validation middleware
export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: result.error.issues.map(i => i.message),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Time format: HH:MM
const timeRegex = /^\d{2}:\d{2}$/;

// Date format: YYYY-MM-DD
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Datetime format: YYYY-MM-DDTHH:MM:SS
const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export const schemas = {
  createEvent: z.object({
    title: z.string().min(1, "Title is required").trim(),
    description: z.string().optional(),
    startTime: z.string().regex(datetimeRegex, "Invalid startTime format (YYYY-MM-DDTHH:MM:SS)"),
    endTime: z.string().regex(datetimeRegex, "Invalid endTime format (YYYY-MM-DDTHH:MM:SS)"),
    allDay: z.boolean().optional().default(false),
    categoryId: z.number().optional().nullable(),
    recurrenceRule: z.string().optional(),
    color: z.string().optional().default("#3b82f6"),
    projectId: z.number().int().positive().optional().nullable(),
  }),

  createTodo: z.object({
    title: z.string().min(1, "Title is required").trim(),
    priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
    category: z.string().optional().default("personal"),
    dueDate: z.string().optional().nullable(),
    parentId: z.number().optional().nullable(),
    status: z.enum(["waiting", "active", "completed"]).optional().default("active"),
    projectId: z.number().int().positive().optional().nullable(),
  }),

  createDDay: z.object({
    title: z.string().min(1, "Title is required").trim(),
    targetDate: z.string().regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    color: z.string().optional().default("#3b82f6"),
    icon: z.string().optional().nullable(),
  }),

  createTimeBlock: z.object({
    date: z.string().regex(dateRegex, "Invalid date format"),
    startTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
    title: z.string().min(1, "Title is required").trim(),
    category: z.string().optional().default("other"),
    color: z.string().optional().nullable(),
  }),

  createReminder: z.object({
    title: z.string().min(1, "Title is required").trim(),
    message: z.string().optional().nullable(),
    remindAt: z.string().min(1, "remindAt is required"),
    repeatRule: z.string().optional().nullable(),
    sourceType: z.string().optional().default("custom"),
    sourceId: z.number().optional().nullable(),
    channel: z.string().optional().default("web_push"),
  }),
};
