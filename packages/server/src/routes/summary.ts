import { Router } from "express";
import { db } from "../db/index.js";
import { todos, projectTasks, projectMembers } from "../db/schema.js";
import { eq, and, inArray, ne, isNull, lte, gte, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

/** Personal todos + assigned project tasks due in the next 7 days (inclusive). */
router.get("/week", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 7);
  const endStr = end.toISOString().slice(0, 10);

  const myTodos = await db
    .select()
    .from(todos)
    .where(
      and(eq(todos.userId, userId), isNull(todos.deletedAt), eq(todos.completed, false)),
    );

  const todosDue = myTodos.filter(
    (t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= endStr,
  );

  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const pids = memberships.map((m) => m.projectId);

  let assignedTasks: (typeof projectTasks.$inferSelect)[] = [];
  if (pids.length > 0) {
    assignedTasks = await db
      .select()
      .from(projectTasks)
      .where(
        and(
          inArray(projectTasks.projectId, pids),
          eq(projectTasks.assigneeId, userId),
          ne(projectTasks.status, "done"),
          isNotNull(projectTasks.dueDate),
          gte(projectTasks.dueDate, todayStr),
          lte(projectTasks.dueDate, endStr),
        ),
      );
  }

  res.json({
    success: true,
    data: {
      personalTodosDue: todosDue.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        projectId: t.projectId,
        priority: t.priority,
      })),
      assignedProjectTasks: assignedTasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        dueDate: t.dueDate,
        status: t.status,
        priority: t.priority,
      })),
    },
  });
}));

export default router;
