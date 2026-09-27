import type { Response, NextFunction } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getProjectRole, type ProjectRole } from '../lib/projectAccess.js';
import { ForbiddenError, ValidationError } from '../lib/errors.js';
import { type AuthRequest, safeParseId } from './auth.js';

export interface ProjectRequest extends AuthRequest {
  projectId?: number;
  projectRole?: ProjectRole;
}

// Verify membership using the same policy as individual project links.
export const projectMemberMiddleware = asyncHandler<ProjectRequest>(async (req, _res, next) => {
  const projectId = safeParseId(req.params.projectId);
  if (projectId === null) throw new ValidationError('Invalid project ID');
  const role = await getProjectRole(req.userId!, projectId);
  if (role === null) throw new ForbiddenError('Not a member of this project');
  req.projectId = projectId;
  req.projectRole = role;
  next();
});

// Verify user is admin or owner of the project
export async function projectAdminMiddleware(
  req: ProjectRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.projectRole !== 'owner' && req.projectRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

// Verify user can edit (not a viewer)
export async function projectEditorMiddleware(
  req: ProjectRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.projectRole || req.projectRole === 'viewer') {
    res.status(403).json({ success: false, error: 'Viewer cannot modify tasks' });
    return;
  }
  next();
}
