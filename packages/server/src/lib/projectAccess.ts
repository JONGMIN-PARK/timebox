import { db } from '../db/index.js';
import { projectMembers, teamGroupMembers, projects } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { ForbiddenError, ValidationError } from './errors.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export async function getProjectRole(
  userId: number,
  projectId: number,
  database: Pick<NodePgDatabase<typeof schema>, 'select'> = db,
): Promise<ProjectRole | null> {
  const [member] = await database
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (member)
    return ['owner', 'admin', 'member', 'viewer'].includes(member.role)
      ? (member.role as ProjectRole)
      : null;
  const [project] = await database.select().from(projects).where(eq(projects.id, projectId));
  if (project?.teamGroupId == null) return null;
  const [groupMember] = await database
    .select()
    .from(teamGroupMembers)
    .where(
      and(eq(teamGroupMembers.groupId, project.teamGroupId), eq(teamGroupMembers.userId, userId)),
    );
  return groupMember ? 'viewer' : null;
}

/** True if user is a direct project member OR in the project's linked team group (viewer). */
export async function userCanAccessProject(userId: number, projectId: number): Promise<boolean> {
  return (await getProjectRole(userId, projectId)) !== null;
}

/** Normalize optional projectId from body; null = none. Throws if invalid or no access. */
export async function resolveOptionalProjectId(
  userId: number,
  projectId: unknown,
): Promise<number | null> {
  if (projectId === undefined || projectId === null || projectId === '') {
    return null;
  }
  const id = typeof projectId === 'number' ? projectId : Number(projectId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ValidationError('Invalid projectId');
  }
  if (!(await userCanAccessProject(userId, id))) {
    throw new ForbiddenError('No access to this project');
  }
  return id;
}
