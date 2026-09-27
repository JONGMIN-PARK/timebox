import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Reusable validation middleware
export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => i.message),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Time format: HH:MM
const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

// Date format: YYYY-MM-DD
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Datetime format: YYYY-MM-DDTHH:MM:SS
const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const projectTaskFields = z.object({
  title: z.string().trim().min(1).max(1000),
  description: z.string().nullable().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  startDate: z.string().regex(dateRegex).nullable().optional(),
  dueDate: z.string().regex(dateRegex).nullable().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const schemas = {
  createProjectTask: projectTaskFields,
  updateProjectTask: projectTaskFields.partial(),
  createEvent: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().optional(),
    startTime: z.string().regex(datetimeRegex, 'Invalid startTime format (YYYY-MM-DDTHH:MM:SS)'),
    endTime: z.string().regex(datetimeRegex, 'Invalid endTime format (YYYY-MM-DDTHH:MM:SS)'),
    allDay: z.boolean().optional().default(false),
    categoryId: z.number().optional().nullable(),
    recurrenceRule: z.string().optional(),
    color: z.string().optional().default('#3b82f6'),
    projectId: z.number().int().positive().optional().nullable(),
  }),

  createTodo: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    category: z.string().optional().default('personal'),
    dueDate: z.string().optional().nullable(),
    parentId: z.number().optional().nullable(),
    status: z.enum(['waiting', 'active', 'completed']).optional().default('active'),
    projectId: z.number().int().positive().optional().nullable(),
    memo: z.string().max(1000).optional().nullable(),
  }),

  createDDay: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    targetDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
    color: z.string().optional().default('#3b82f6'),
    icon: z.string().optional().nullable(),
  }),

  createTimeBlock: z.object({
    date: z.string().regex(dateRegex, 'Invalid date format'),
    startTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    title: z.string().trim().min(1, 'Title is required'),
    category: z.string().optional().default('other'),
    color: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    meta: z.string().optional().nullable(),
  }),

  updateTimeBlock: z.object({
    date: z.string().regex(dateRegex).optional(),
    title: z.string().trim().min(1).optional(),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    category: z.string().min(1).optional(),
    color: z.string().nullable().optional(),
    completed: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    meta: z.string().nullable().optional(),
  }),
  createReminder: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    message: z.string().optional().nullable(),
    remindAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().optional().nullable(),
    sourceType: z.string().optional().default('custom'),
    sourceId: z.number().optional().nullable(),
    channel: z.enum(['telegram', 'web_push', 'both']).optional().default('web_push'),
  }),
  updateReminder: z.object({
    title: z.string().trim().min(1).optional(),
    message: z.string().nullable().optional(),
    remindAt: z.string().datetime({ offset: true }).optional(),
    repeatRule: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    sent: z.boolean().optional(),
    channel: z.enum(['telegram', 'web_push', 'both']).optional(),
  }),
  snoozeReminder: z.object({ duration: z.number().int().min(1).max(10080).default(15) }),
};
