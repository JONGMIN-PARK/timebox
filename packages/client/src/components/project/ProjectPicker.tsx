import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

interface ProjectPickerProps {
  value: number | null;
  onChange: (projectId: number | null) => void;
  className?: string;
  disabled?: boolean;
}

/** Projects the current user can access (member or team group viewer). */
export function ProjectPicker({ value, onChange, className, disabled }: ProjectPickerProps) {
  const { t } = useI18n();
  const { projects, fetchProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const list = projects.filter((p) => !p.archived);

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-slate-500 dark:text-slate-400 block">
        {t("project.pickerLabel")}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : parseInt(v, 10));
        }}
        disabled={disabled}
        className="w-full text-sm bg-slate-100/80 dark:bg-slate-700/50 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 outline-none border border-transparent focus:border-blue-500/40"
      >
        <option value="">{t("project.pickerNone")}</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
