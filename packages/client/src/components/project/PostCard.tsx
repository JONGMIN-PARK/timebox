import React from "react";
import { Pin, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

type PostCategory = "notice" | "discussion" | "question";

interface PostCardPost {
  id: number;
  title: string;
  category: PostCategory;
  pinned: boolean;
  authorName: string;
  commentCount: number;
  createdAt: string;
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

interface PostCardProps {
  post: PostCardPost;
  onClick: () => void;
}

const PostCard = React.memo(function PostCard({ post, onClick }: PostCardProps) {
  const { t } = useI18n();

  return (
    <button
      onClick={onClick}
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
  );
});

export default PostCard;
