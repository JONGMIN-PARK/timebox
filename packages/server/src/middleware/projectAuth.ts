import { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { projectMembers, teamGroupMembers, projects } from "../db/schema.js";
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
    // Check if user is in the project's team group
    const project = await db.select().from(projects).where(eq(projects.id, projectId));
    if (project[0]?.teamGroupId) {
      const groupMembership = await db.select().from(teamGroupMembers)
        .where(and(
          eq(teamGroupMembers.groupId, project[0].teamGroupId),
          eq(teamGroupMembers.userId, req.userId!)
        ));
      if (groupMembership[0]) {
        req.projectId = projectId;
        req.projectRole = "viewer";
        next();
        return;
      }
    }
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

// Verify user can edit (not a viewer)
export async function projectEditorMiddleware(req: ProjectRequest, res: Response, next: NextFunction) {
  if (req.projectRole === "viewer") {
    res.status(403).json({ success: false, error: "Viewer cannot modify tasks" });
    return;
  }
  next();
}
