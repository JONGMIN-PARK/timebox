import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import PostCard from "./PostCard";
import PostEditor from "./PostEditor";
import PostDetail from "./PostDetail";

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
            <PostCard
              key={post.id}
              post={post}
              onClick={() => openDetail(post)}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Main render ──

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      {mode === "list" && renderList()}
      {mode === "write" && (
        <PostEditor
          isEditing={!!editingPost}
          formTitle={formTitle}
          formContent={formContent}
          formCategory={formCategory}
          onTitleChange={setFormTitle}
          onContentChange={setFormContent}
          onCategoryChange={setFormCategory}
          onSave={handleSavePost}
          onCancel={() => { goBack(); resetForm(); }}
        />
      )}
      {mode === "detail" && selectedPost && (
        <PostDetail
          post={selectedPost}
          isAuthor={isAuthor}
          commentText={commentText}
          submittingComment={submittingComment}
          onCommentTextChange={setCommentText}
          onSubmitComment={handleSubmitComment}
          onDeleteComment={handleDeleteComment}
          onEdit={() => openEdit(selectedPost)}
          onDelete={() => handleDeletePost(selectedPost.id)}
          onBack={goBack}
        />
      )}
    </div>
  );
}
