import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { FileText, Pencil, Save, X } from "lucide-react";

interface ProjectDocsProps {
  projectId: number;
  myRole: string;
}

export default function ProjectDocs({ projectId, myRole }: ProjectDocsProps) {
  const { t } = useI18n();
  const [docs, setDocs] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    api.get<{ docs: string | null }>(`/projects/${projectId}`).then((res) => {
      if (res.success && res.data) {
        setDocs(res.data.docs || "");
      }
      setLoading(false);
    });
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    const res = await api.put(`/projects/${projectId}`, { docs: editText });
    if (res.success) {
      setDocs(editText);
      setEditing(false);
    }
    setSaving(false);
  };

  const startEdit = () => {
    setEditText(docs);
    setEditing(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          {t("project.docs")}
        </h2>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-500 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            {t("common.edit")}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={20}
            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
            placeholder="프로젝트 개요, 요구사양, 참고 문서 등을 기록하세요..."
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3 h-3" />
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3 h-3" />
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      ) : docs ? (
        <div className="card p-5">
          <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
            {docs}
          </pre>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {canEdit ? "프로젝트 문서를 작성해주세요" : "등록된 문서가 없습니다"}
          </p>
          {canEdit && (
            <button
              onClick={startEdit}
              className="mt-3 text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              작성하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
