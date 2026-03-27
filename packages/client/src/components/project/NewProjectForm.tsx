import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/lib/useI18n";
import { Palette } from "lucide-react";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

interface NewProjectFormProps {
  onCreated: (projectId: number) => void;
  onCancel: () => void;
}

export default function NewProjectForm({ onCreated, onCancel }: NewProjectFormProps) {
  const { t } = useI18n();
  const { createProject } = useProjectStore();
  const user = useAuthStore(s => s.user);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [docs, setDocs] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [teamGroupId, setTeamGroupId] = useState<number | "">(
    user?.teamGroups?.length === 1 ? user.teamGroups[0].id : ""
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const teamGroups = user?.teamGroups || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError("");

    const project = await createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      teamGroupId: teamGroupId ? Number(teamGroupId) : undefined,
      startDate: startDate || undefined,
      targetDate: targetDate || undefined,
      docs: docs.trim() || undefined,
    });

    if (project) {
      onCreated(project.id);
    } else {
      setError(t("project.createFailed") || "Failed to create project");
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("project.new")}
        </h2>

        {/* Name */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
            {t("project.name")} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("project.name")}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
            {t("project.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("project.description")}
            rows={3}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Project Docs */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
            프로젝트 개요 / 사양 / 문서
          </label>
          <textarea
            value={docs}
            onChange={(e) => setDocs(e.target.value)}
            placeholder="프로젝트 개요, 요구사양, 참고 문서 등을 기록하세요..."
            rows={6}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              목표일
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Palette className="w-3 h-3" /> Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Team Group selector (if multiple groups) */}
        {teamGroups.length > 1 && (
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              {t("group.title")}
            </label>
            <select
              value={teamGroupId}
              onChange={(e) => setTeamGroupId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("group.selectUser")}</option>
              {teamGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? t("common.loading") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
