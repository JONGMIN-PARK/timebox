import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { Pin, MessageSquare, ArrowLeft, Pencil, Trash2, Plus } from "lucide-react";

// ── Types ──

type PostCategory = "notice" | "discussion" | "question";

interface PostComment {
  id: number;
  postId: number;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Post {
  id: number;
  projectId: number;
  title: string;
  content: string;
  category: PostCategory;
  pinned: boolean;
  authorId: number;
  authorName: string;
  commentCount: number;
  comments?: PostComment[];
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "list" | "write" | "detail";

// ── Helpers ──

const CATEGORY_STYLES: Record<PostCategory, string> = {
  notice: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  discussion: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  question: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
};

const CATEGORY_KEYS: Record<PostCategory, string> = {
  notice: "post.notice",
  discussion: "post.discussion",
  question: "post.question",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

// ── Component ──

interface PostBoardProps {
  projectId: number;
}

export default function PostBoard({ projectId }: PostBoardProps) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);

  // State
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>("list");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [filterCategory, setFilterCategory] = useState<PostCategory | "all">("all");

  // Write/Edit form state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<PostCategory>("discussion");

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // ── Data fetching ──

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Post[]>(`/projects/${projectId}/posts`);
    if (res.success && res.data) {
      setPosts(res.data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const fetchPostDetail = async (postId: number) => {
    const res = await api.get<Post>(`/projects/${projectId}/posts/${postId}`);
    if (res.success && res.data) {
      setSelectedPost(res.data);
    }
  };

  // ── Actions ──

  const handleSavePost = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    const body = {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
    };

    if (editingPost) {
      const res = await api.put<Post>(`/projects/${projectId}/posts/${editingPost.id}`, body);
      if (res.success) {
        await fetchPosts();
        setMode("list");
        resetForm();
      }
    } else {
      const res = await api.post<Post>(`/projects/${projectId}/posts`, body);
      if (res.success) {
        await fetchPosts();
        setMode("list");
        resetForm();
      }
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm(t("common.delete") + "?")) return;
    const res = await api.delete(`/projects/${projectId}/posts/${postId}`);
    if (res.success) {
      await fetchPosts();
      setMode("list");
      setSelectedPost(null);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    setSubmittingComment(true);
    const res = await api.post<PostComment>(
      `/projects/${projectId}/posts/${selectedPost.id}/comments`,
      { content: commentText.trim() },
    );
    if (res.success) {
      setCommentText("");
      await fetchPostDetail(selectedPost.id);
      // Update comment count in list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, commentCount: p.commentCount + 1 } : p,
        ),
      );
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedPost) return;
    const res = await api.delete(
      `/projects/${projectId}/posts/${selectedPost.id}/comments/${commentId}`,
    );
    if (res.success) {
      await fetchPostDetail(selectedPost.id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
        ),
      );
    }
  };

  // ── Helpers ──

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("discussion");
    setEditingPost(null);
  };

  const openWrite = () => {
    resetForm();
    setMode("write");
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormCategory(post.category);
    setMode("write");
  };

  const openDetail = async (post: Post) => {
    setSelectedPost(post);
    setMode("detail");
    await fetchPostDetail(post.id);
  };

  const goBack = () => {
    setMode("list");
    setSelectedPost(null);
    setCommentText("");
  };

  // ── Filtered & sorted posts ──

  const sortedPosts = useMemo(() => {
    const filtered = posts.filter(
      (p) => filterCategory === "all" || p.category === filterCategory,
    );
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts, filterCategory]);

  const isAuthor = (authorId: number) => user?.id === authorId;

  // ── Category filter tabs ──

  const categoryTabs: { key: PostCategory | "all"; label: string }[] = [
    { key: "all", label: t("post.all") },
    { key: "notice", label: t("post.notice") },
    { key: "discussion", label: t("post.discussion") },
    { key: "question", label: t("post.question") },
  ];

  // ── Render: List View ──

  const renderList = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {t("post.title")}
        </h2>
        <button
          onClick={openWrite}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("post.write")}
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterCategory(tab.key)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              filterCategory === tab.key
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">{t("common.loading")}</div>
      ) : sortedPosts.length === 0 ? (
        <div className="py-12 text-center text-slate-400">{t("post.noPost")}</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {sortedPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => openDetail(post)}
              className="w-full text-left px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-3"
            >
              {/* Pin icon */}
              {post.pinned && (
                <Pin className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}

              {/* Category badge */}
              <span
                className={cn(
                  "px-2 py-0.5 text-[11px] font-medium rounded-full flex-shrink-0",
                  CATEGORY_STYLES[post.category],
                )}
              >
                {t(CATEGORY_KEYS[post.category])}
              </span>

              {/* Title + pinned badge */}
              <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate font-medium">
                {post.title}
                {post.pinned && (
                  <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    [{t("post.pinned")}]
                  </span>
                )}
              </span>

              {/* Author */}
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                {post.authorName}
              </span>

              {/* Date */}
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 w-20 text-right">
                {formatDate(post.createdAt).split(" ")[0]}
              </span>

              {/* Comment count */}
              {post.commentCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                  <MessageSquare className="w-3 h-3" />
                  {post.commentCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render: Write/Edit View ──

  const renderWrite = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {editingPost ? t("common.edit") : t("post.write")}
        </h2>
      </div>

      {/* Category select */}
      <div>
        <select
          value={formCategory}
          onChange={(e) => setFormCategory(e.target.value as PostCategory)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="notice">{t("post.notice")}</option>
          <option value="discussion">{t("post.discussion")}</option>
          <option value="question">{t("post.question")}</option>
        </select>
      </div>

      {/* Title input */}
      <div>
        <input
          type="text"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder={t("post.titlePlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content textarea */}
      <div>
        <textarea
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          placeholder={t("post.contentPlaceholder")}
          rows={12}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { goBack(); resetForm(); }}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSavePost}
          disabled={!formTitle.trim() || !formContent.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );

  // ── Render: Detail View ──

  const renderDetail = () => {
    if (!selectedPost) return null;

    return (
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">
            {t("post.title")}
          </h2>
        </div>

        {/* Post card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
          {/* Category badge + pinned */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2 py-0.5 text-[11px] font-medium rounded-full",
                CATEGORY_STYLES[selectedPost.category],
              )}
            >
              {t(CATEGORY_KEYS[selectedPost.category])}
            </span>
            {selectedPost.pinned && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Pin className="w-3 h-3" />
                {t("post.pinned")}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {selectedPost.title}
          </h3>

          {/* Meta: author, date */}
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <span>{selectedPost.authorName}</span>
            <span>{formatDate(selectedPost.createdAt)}</span>
          </div>

          {/* Author actions */}
          {isAuthor(selectedPost.authorId) && (
            <div className="flex gap-2">
              <button
                onClick={() => openEdit(selectedPost)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t("common.edit")}
              </button>
              <button
                onClick={() => handleDeletePost(selectedPost.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {t("common.delete")}
              </button>
            </div>
          )}

          {/* Content */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {selectedPost.content}
            </p>
          </div>
        </div>

        {/* Comments section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            {t("post.comment")} ({selectedPost.comments?.length ?? 0})
          </h4>

          {/* Comment list */}
          {selectedPost.comments && selectedPost.comments.length > 0 ? (
            <div className="space-y-3">
              {selectedPost.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {comment.authorName}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                  {isAuthor(comment.authorId) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
              {t("post.noPost")}
            </p>
          )}

          {/* Comment input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              placeholder={t("post.commentPlaceholder")}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || submittingComment}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ──

  return (
    <div className="h-full overflow-y-auto p-4">
      {mode === "list" && renderList()}
      {mode === "write" && renderWrite()}
      {mode === "detail" && renderDetail()}
    </div>
  );
}
