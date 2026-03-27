import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
