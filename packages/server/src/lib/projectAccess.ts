import { db } from "../db/index.js";
import { projectMembers, teamGroupMembers, projects } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, ValidationError } from "./errors.js";

/** True if user is a direct project member OR in the project's linked team group (viewer). */
export async function userCanAccessProject(userId: number, projectId: number): Promise<boolean> {
  const pm = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (pm[0]) return true;
  const proj = await db.select().from(projects).where(eq(projects.id, projectId));
  const tg = proj[0]?.teamGroupId;
  if (tg != null) {
    const gm = await db
      .select()
      .from(teamGroupMembers)
      .where(and(eq(teamGroupMembers.groupId, tg), eq(teamGroupMembers.userId, userId)));
    if (gm[0]) return true;
  }
  return false;
}

/** Normalize optional projectId from body; null = none. Throws if invalid or no access. */
export async function resolveOptionalProjectId(
  userId: number,
  projectId: unknown,
): Promise<number | null> {
  if (projectId === undefined || projectId === null || projectId === "") {
    return null;
  }
  const id = typeof projectId === "number" ? projectId : parseInt(String(projectId), 10);
  if (Number.isNaN(id) || id < 1) {
    throw new ValidationError("Invalid projectId");
  }
  if (!(await userCanAccessProject(userId, id))) {
    throw new ForbiddenError("No access to this project");
  }
  return id;
}
