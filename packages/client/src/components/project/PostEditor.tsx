import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type PostCategory = "notice" | "discussion" | "question";

interface PostEditorProps {
  isEditing: boolean;
  formTitle: string;
  formContent: string;
  formCategory: PostCategory;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onCategoryChange: (category: PostCategory) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function PostEditor({
  isEditing,
  formTitle,
  formContent,
  formCategory,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onSave,
  onCancel,
}: PostEditorProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {isEditing ? t("common.edit") : t("post.write")}
        </h2>
      </div>

      {/* Category select */}
      <div>
        <select
          value={formCategory}
          onChange={(e) => onCategoryChange(e.target.value as PostCategory)}
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
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("post.titlePlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content textarea */}
      <div>
        <textarea
          value={formContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t("post.contentPlaceholder")}
          rows={12}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={onSave}
          disabled={!formTitle.trim() || !formContent.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
