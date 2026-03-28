import { Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { userActivityLog } from "../db/schema.js";
import type { AuthRequest } from "./auth.js";

interface RouteMapping {
  category: string;
  targetType: string;
}

const ROUTE_MAP: Record<string, RouteMapping> = {
  todos: { category: "personal", targetType: "todo" },
  events: { category: "personal", targetType: "event" },
  timeblocks: { category: "personal", targetType: "timeblock" },
  ddays: { category: "personal", targetType: "dday" },
  reminders: { category: "personal", targetType: "reminder" },
  files: { category: "personal", targetType: "file" },
  projects: { category: "project", targetType: "project" },
  chat: { category: "general", targetType: "chat" },
  inbox: { category: "general", targetType: "inbox" },
};

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/** Routes to skip entirely */
const SKIP_PREFIXES = ["/api/auth", "/api/health", "/api/analytics"];

function parseRoute(method: string, path: string) {
  // Skip auth, health, analytics routes
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  // Remove query string
  const cleanPath = path.split("?")[0];
  const segments = cleanPath.replace(/^\/api\//, "").split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const resource = segments[0];
  const mapping = ROUTE_MAP[resource];
  if (!mapping) return null;

  const resourceId = segments.length > 1 ? parseInt(segments[1]) : undefined;
  const hasId = resourceId && !isNaN(resourceId);

  // Skip GET list requests (no specific resource ID)
  if (method === "GET" && !hasId) {
    return null;
  }

  // Determine action verb
  let verb: string;
  if (method === "GET" && hasId) {
    verb = "view";
  } else {
    verb = METHOD_ACTION_MAP[method];
    if (!verb) return null;
  }

  // Special handling for specific sub-resources
  const { category, targetType } = mapping;
  let action = `${targetType}.${verb}`;
  let projectId: number | undefined;
  let actualTargetType = targetType;
  let targetId = hasId ? resourceId : undefined;

  // For projects, extract projectId and detect sub-resources
  if (resource === "projects" && hasId) {
    projectId = resourceId;
    if (segments.length > 2) {
      const subResource = segments[2];
      // Map sub-resources: tasks, posts, files, members, etc.
      const subMap: Record<string, string> = {
        tasks: "task",
        posts: "post",
        files: "file",
        members: "member",
        docs: "docs",
      };
      const subType = subMap[subResource] || subResource;
      actualTargetType = subType;

      const subId = segments.length > 3 ? parseInt(segments[3]) : undefined;
      const hasSubId = subId && !isNaN(subId);

      if (method === "GET" && !hasSubId) {
        return null; // skip list of sub-resources
      }

      verb = method === "GET" && hasSubId ? "view" : METHOD_ACTION_MAP[method] || "view";
      action = `${subType}.${verb}`;
      targetId = hasSubId ? subId : undefined;
    }
  }

  // Special action names for chat and inbox
  if (resource === "chat") {
    if (verb === "create" && segments.length > 2 && segments[2] === "messages") {
      action = "chat.message";
    } else if (verb === "create" && segments.length === 1) {
      action = "chat.create";
    }
  }

  if (resource === "inbox") {
    if (verb === "create") action = "inbox.send";
    if (verb === "update") action = "inbox.read";
  }

  if (resource === "files") {
    if (verb === "create") action = "file.upload";
    if (method === "GET" && hasId) action = "file.download";
  }

  return {
    action,
    category: resource === "projects" ? "project" : category,
    targetType: actualTargetType,
    targetId,
    projectId,
  };
}

export function activityTracker(req: AuthRequest, res: Response, next: NextFunction) {
  res.on("finish", () => {
    // Only log for authenticated users
    if (!req.userId) return;

    // Only log successful responses (2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const parsed = parseRoute(req.method, req.originalUrl || req.url);
    if (!parsed) return;

    const { action, category, targetType, targetId, projectId } = parsed;

    // Log asynchronously - fire and forget
    db.insert(userActivityLog)
      .values({
        userId: req.userId,
        action,
        category,
        targetType,
        targetId,
        projectId,
        metadata: JSON.stringify({
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
        }),
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      })
      .execute()
      .catch((err) => {
        console.error("[activityTracker] Failed to log activity:", err);
      });
  });

  next();
}
