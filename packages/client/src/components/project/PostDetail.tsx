import { ArrowLeft, Pin, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

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

interface PostDetailProps {
  post: Post;
  isAuthor: (authorId: number) => boolean;
  commentText: string;
  submittingComment: boolean;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (commentId: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export default function PostDetail({
  post,
  isAuthor,
  commentText,
  submittingComment,
  onCommentTextChange,
  onSubmitComment,
  onDeleteComment,
  onEdit,
  onDelete,
  onBack,
}: PostDetailProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
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
              CATEGORY_STYLES[post.category],
            )}
          >
            {t(CATEGORY_KEYS[post.category])}
          </span>
          {post.pinned && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Pin className="w-3 h-3" />
              {t("post.pinned")}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {post.title}
        </h3>

        {/* Meta: author, date */}
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span>{post.authorName}</span>
          <span>{formatDate(post.createdAt)}</span>
        </div>

        {/* Author actions */}
        {isAuthor(post.authorId) && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {t("common.edit")}
            </button>
            <button
              onClick={onDelete}
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
            {post.content}
          </p>
        </div>
      </div>

      {/* Comments section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4" />
          {t("post.comment")} ({post.comments?.length ?? 0})
        </h4>

        {/* Comment list */}
        {post.comments && post.comments.length > 0 ? (
          <div className="space-y-3">
            {post.comments.map((comment) => (
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
                    onClick={() => onDeleteComment(comment.id)}
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
            onChange={(e) => onCommentTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmitComment();
              }
            }}
            placeholder={t("post.commentPlaceholder")}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onSubmitComment}
            disabled={!commentText.trim() || submittingComment}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
