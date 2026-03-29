import { useEffect, useState } from "react";
import { summaryApi } from "@/lib/apiService";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

export default function WeekSummaryChip() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    summaryApi.week().then((res) => {
      if (res.success && res.data) {
        setCount(res.data.personalTodosDue.length + res.data.assignedProjectTasks.length);
      }
    });
  }, []);

  if (count === 0) return null;

  return (
    <span
      className={cn(
        "text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-full flex-shrink-0",
        "bg-amber-100/90 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-500/25",
      )}
      title={t("summary.weekHint")}
    >
      {count} {t("summary.weekHint")}
    </span>
  );
}
