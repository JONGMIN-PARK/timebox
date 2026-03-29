import React, { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ProjectTask, TaskStatus } from "@/stores/projectTaskStore";
import type { ProjectMember } from "@/stores/projectStore";
import KanbanCard from "./KanbanCard";
import KanbanColumnHeader from "./KanbanColumnHeader";

/** Stable sort: by sortOrder, then by id as tiebreaker */
function stableSort(tasks: ProjectTask[]) {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

interface KanbanColumnProps {
  column: { key: TaskStatus; label: string; color: string };
  tasks: ProjectTask[];
  members: ProjectMember[];
  onClickTask: (task: ProjectTask) => void;
  onAddTask: (status: TaskStatus, title: string) => void;
  isDraggingAny: boolean;
  readOnly?: boolean;
}

function KanbanColumn({
  column,
  tasks,
  members,
  onClickTask,
  onAddTask,
  isDraggingAny,
  readOnly,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    onAddTask(column.key, newTitle.trim());
    setNewTitle("");
    setAdding(false);
  };

  const sorted = stableSort(tasks);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[80vw] sm:w-[240px] md:w-[260px] min-w-[200px] flex-shrink-0 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 transition-colors",
        isOver && !readOnly && "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/5",
      )}
    >
      {/* Column header */}
      <KanbanColumnHeader label={column.label} color={column.color} count={tasks.length} />

      {/* Cards */}
      <div className={cn("flex-1 px-2 py-2 space-y-2 min-h-[100px]", isDraggingAny ? "overflow-visible" : "overflow-y-auto")}>
        <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                members={members}
                onClick={() => onClickTask(task)}
                readOnly={readOnly}
              />
            ))}
        </SortableContext>
      </div>

      {/* Add task -- hidden for viewers */}
      {!readOnly && (
        <div className="px-2 pb-2">
          {adding ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              <input
                ref={inputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
                }}
                onBlur={handleAdd}
                placeholder="Task title..."
                className="w-full text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label={`Add task to ${column.label}`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default KanbanColumn;
