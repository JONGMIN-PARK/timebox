import { Router } from "express";
import { db } from "../db/index.js";
import { posts, postComments, activityLog, users } from "../db/schema.js";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const router = Router();

// All routes require project membership
router.use("/:projectId/posts", projectMemberMiddleware);

// GET /api/projects/:projectId/posts
router.get("/:projectId/posts", async (req: ProjectRequest, res) => {
  try {
    const { category } = req.query;

    let allPosts = await db.select().from(posts)
      .where(eq(posts.projectId, req.projectId!))
      .orderBy(desc(posts.pinned), desc(posts.createdAt));

    if (category) {
      allPosts = allPosts.filter(p => p.category === category);
    }

    // Attach author names and comment counts
    const allUsers = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.username]));

    const postIds = allPosts.map(p => p.id);
    const projectComments = postIds.length > 0
      ? await db.select().from(postComments).where(inArray(postComments.postId, postIds))
      : [];
    const commentCountMap = new Map<number, number>();
    for (const c of projectComments) {
      commentCountMap.set(c.postId, (commentCountMap.get(c.postId) || 0) + 1);
    }

    const data = allPosts.map(p => ({
      ...p,
      authorName: userMap.get(p.authorId) || "Unknown",
      commentCount: commentCountMap.get(p.id) || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("projectPosts:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch posts" });
  }
});

// POST /api/projects/:projectId/posts
router.post("/:projectId/posts", async (req: ProjectRequest, res) => {
  try {
    const { title, content, category, pinned } = req.body;
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ success: false, error: "Title and content are required" });
      return;
    }

    const result = await db.insert(posts).values({
      projectId: req.projectId!,
      authorId: req.userId!,
      title: title.trim(),
      content: content.trim(),
      category: category || "discussion",
      pinned: pinned || false,
    }).returning();

    // Log activity
    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "post_created",
      targetType: "post",
      targetId: result[0].id,
      metadata: JSON.stringify({ title: result[0].title }),
    });

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectPosts:create", error);
    res.status(500).json({ success: false, error: "Failed to create post" });
  }
});

// PUT /api/projects/:projectId/posts/:postId
router.put("/:projectId/posts/:postId", async (req: ProjectRequest, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    // Check ownership or admin
    const existing = await db.select().from(posts)
      .where(and(eq(posts.id, postId), eq(posts.projectId, req.projectId!)));
    if (!existing[0]) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    if (existing[0].authorId !== req.userId! && req.projectRole !== "owner" && req.projectRole !== "admin") {
      res.status(403).json({ success: false, error: "Only author or admin can edit this post" });
      return;
    }

    const { title, content, category, pinned } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;
    if (pinned !== undefined) updates.pinned = pinned;

    const result = await db.update(posts).set(updates)
      .where(eq(posts.id, postId)).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectPosts:update", error);
    res.status(500).json({ success: false, error: "Failed to update post" });
  }
});

// DELETE /api/projects/:projectId/posts/:postId
router.delete("/:projectId/posts/:postId", async (req: ProjectRequest, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    const existing = await db.select().from(posts)
      .where(and(eq(posts.id, postId), eq(posts.projectId, req.projectId!)));
    if (!existing[0]) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    if (existing[0].authorId !== req.userId! && req.projectRole !== "owner" && req.projectRole !== "admin") {
      res.status(403).json({ success: false, error: "Only author or admin can delete this post" });
      return;
    }

    // Delete comments first
    await db.delete(postComments).where(eq(postComments.postId, postId));
    await db.delete(posts).where(eq(posts.id, postId));

    res.json({ success: true });
  } catch (error) {
    console.error("projectPosts:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete post" });
  }
});

// GET /api/projects/:projectId/posts/:postId/comments
router.get("/:projectId/posts/:postId/comments", async (req: ProjectRequest, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    const comments = await db.select().from(postComments)
      .where(eq(postComments.postId, postId))
      .orderBy(asc(postComments.createdAt));

    // Attach author names
    const allUsers = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.username]));

    const data = comments.map(c => ({
      ...c,
      authorName: userMap.get(c.authorId) || "Unknown",
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("projectPosts:listComments", error);
    res.status(500).json({ success: false, error: "Failed to fetch comments" });
  }
});

// POST /api/projects/:projectId/posts/:postId/comments
router.post("/:projectId/posts/:postId/comments", async (req: ProjectRequest, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    if (isNaN(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, error: "Content is required" });
      return;
    }

    // Verify post exists in this project
    const existing = await db.select().from(posts)
      .where(and(eq(posts.id, postId), eq(posts.projectId, req.projectId!)));
    if (!existing[0]) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    const result = await db.insert(postComments).values({
      postId,
      authorId: req.userId!,
      content: content.trim(),
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectPosts:addComment", error);
    res.status(500).json({ success: false, error: "Failed to add comment" });
  }
});

// DELETE /api/projects/:projectId/posts/:postId/comments/:commentId
router.delete("/:projectId/posts/:postId/comments/:commentId", async (req: ProjectRequest, res) => {
  try {
    const postId = parseInt(req.params.postId as string);
    const commentId = parseInt(req.params.commentId as string);
    if (isNaN(postId) || isNaN(commentId)) {
      res.status(400).json({ success: false, error: "Invalid ID" });
      return;
    }

    const existing = await db.select().from(postComments)
      .where(and(eq(postComments.id, commentId), eq(postComments.postId, postId)));
    if (!existing[0]) {
      res.status(404).json({ success: false, error: "Comment not found" });
      return;
    }

    if (existing[0].authorId !== req.userId! && req.projectRole !== "owner" && req.projectRole !== "admin") {
      res.status(403).json({ success: false, error: "Only author or admin can delete this comment" });
      return;
    }

    await db.delete(postComments).where(eq(postComments.id, commentId));
    res.json({ success: true });
  } catch (error) {
    console.error("projectPosts:deleteComment", error);
    res.status(500).json({ success: false, error: "Failed to delete comment" });
  }
});

export default router;
