import { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { projectMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { type AuthRequest } from "./auth.js";

export interface ProjectRequest extends AuthRequest {
  projectId?: number;
  projectRole?: string;
}

// Verify user is a member of the project
export async function projectMemberMiddleware(req: ProjectRequest, res: Response, next: NextFunction) {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) {
    res.status(400).json({ success: false, error: "Invalid project ID" });
    return;
  }

  const members = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, req.userId!)));

  if (!members[0]) {
    res.status(403).json({ success: false, error: "Not a member of this project" });
    return;
  }

  req.projectId = projectId;
  req.projectRole = members[0].role;
  next();
}

// Verify user is admin or owner of the project
export async function projectAdminMiddleware(req: ProjectRequest, res: Response, next: NextFunction) {
  if (req.projectRole !== "owner" && req.projectRole !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }
  next();
}
