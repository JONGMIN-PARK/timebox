import { useEffect, useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useProjectTaskStore, type ProjectTask, type TaskStatus } from "@/stores/projectTaskStore";
import { useProjectStore, type ProjectMember } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import TaskDetailModal from "./TaskDetailModal";
import KanbanColumn from "./KanbanColumn";

// ── Column config ──
const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "#94a3b8" },
  { key: "todo", label: "To Do", color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "review", label: "Review", color: "#8b5cf6" },
  { key: "done", label: "Done", color: "#10b981" },
];

// ── Main KanbanBoard ──
interface KanbanBoardProps {
  projectId: number;
  myRole?: string;
}

export default function KanbanBoard({ projectId, myRole }: KanbanBoardProps) {
  const { tasks, loading, error, fetchTasks, addTask, updateTask, deleteTask, reorderTasks } =
    useProjectTaskStore();
  const { fetchMembers } = useProjectStore();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  const readOnly = myRole === "viewer";

  const notifyTaskChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent("project-tasks-updated", { detail: { projectId } }));
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    fetchTasks(projectId);
    fetchMembers(projectId).then(setMembers);
  }, [projectId, fetchTasks, fetchMembers]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, ProjectTask[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }
    return grouped;
  }, [tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if dropped on a column (status string) or on another task (number)
    const isColumnDrop = typeof overId === "string" && ["backlog", "todo", "in_progress", "review", "done"].includes(overId);

    if (isColumnDrop) {
      const targetStatus = overId as TaskStatus;
      if (activeTask.status === targetStatus) return;

      // Move to new column
      const updatedTasks = tasks.map(t =>
        t.id === activeId ? { ...t, status: targetStatus } : t
      );
      useProjectTaskStore.setState({ tasks: updatedTasks });
      updateTask(projectId, activeId, { status: targetStatus });

      const targetTasks = updatedTasks.filter(t => t.status === targetStatus).sort((a, b) => a.sortOrder - b.sortOrder);
      reorderTasks(projectId, targetTasks.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
    } else {
      // Dropped on another task — reorder within same column OR move to different column
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      const targetStatus = overTask.status;
      const sameColumn = activeTask.status === targetStatus;

      // Get column tasks
      let columnTasks = tasks
        .filter(t => t.status === targetStatus)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (!sameColumn) {
        // Move to new column first
        const movedTask = { ...activeTask, status: targetStatus };
        columnTasks = [...columnTasks.filter(t => t.id !== activeId), movedTask];
      }

      // Reorder: remove active, insert at over position
      const oldIndex = columnTasks.findIndex(t => t.id === activeId);
      const newIndex = columnTasks.findIndex(t => t.id === (overId as number));

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = [...columnTasks];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        // Update sort orders
        const updatedTasks = tasks.map(t => {
          const idx = reordered.findIndex(r => r.id === t.id);
          if (idx !== -1) return { ...t, status: targetStatus, sortOrder: idx };
          if (t.id === activeId && !sameColumn) return { ...t, status: targetStatus };
          return t;
        });

        useProjectTaskStore.setState({ tasks: updatedTasks });
        reorderTasks(projectId, reordered.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
      } else if (!sameColumn) {
        // Just move between columns (dropped on task in different column)
        const updatedTasks = tasks.map(t =>
          t.id === activeId ? { ...t, status: targetStatus } : t
        );
        useProjectTaskStore.setState({ tasks: updatedTasks });
        updateTask(projectId, activeId, { status: targetStatus });

        const targetTasks = updatedTasks.filter(t => t.status === targetStatus).sort((a, b) => a.sortOrder - b.sortOrder);
        reorderTasks(projectId, targetTasks.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
      }
    }
    // Notify stats refresh on any status change
    showToast("success", "Task status changed");
    notifyTaskChange();
  }, [tasks, projectId, updateTask, reorderTasks, notifyTaskChange]);

  const currentUserId = useAuthStore(s => s.user?.id);

  const handleAddTask = useCallback(async (status: TaskStatus, title: string) => {
    const maxSort = tasksByStatus[status].reduce(
      (max, t) => Math.max(max, t.sortOrder),
      -1,
    );
    await addTask(projectId, {
      title,
      status,
      priority: "medium",
      sortOrder: maxSort + 1,
      assigneeId: currentUserId || undefined,
    });
    showToast("success", "Task created");
    notifyTaskChange();
  }, [projectId, addTask, tasksByStatus, currentUserId, notifyTaskChange]);

  const handleUpdateTask = useCallback(async (taskId: number, data: Partial<ProjectTask>) => {
    await updateTask(projectId, taskId, data);
    showToast("success", "Task updated");
    notifyTaskChange();
  }, [projectId, updateTask, notifyTaskChange]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    await deleteTask(projectId, taskId);
    showToast("success", "Task deleted");
    notifyTaskChange();
  }, [projectId, deleteTask, notifyTaskChange]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Board */}
      <div className={cn("flex-1 px-2 sm:px-4 py-2 sm:py-4", dragActiveId ? "overflow-visible" : "overflow-x-auto overflow-y-hidden")}>
        <DndContext
          sensors={readOnly ? [] : sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragActiveId(null)}
        >
          <div className="flex gap-2 sm:gap-3 md:gap-4 h-full min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus[col.key]}
                members={members}
                onClickTask={setSelectedTask}
                onAddTask={handleAddTask}
                isDraggingAny={dragActiveId !== null}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Card moves via useSortable transform — no DragOverlay needed */}
        </DndContext>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          projectId={projectId}
          task={selectedTask}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
