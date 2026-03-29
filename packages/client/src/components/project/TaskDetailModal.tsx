import { useState, useEffect } from "react";
import type { ProjectTask, TaskStatus } from "@/stores/projectTaskStore";
import type { ProjectMember } from "@/stores/projectStore";
import TaskDetailHeader from "./TaskDetailHeader";
import TaskDetailBody from "./TaskDetailBody";
import TaskDetailComments from "./TaskDetailComments";
import TaskDetailActions from "./TaskDetailActions";

interface TaskDetailModalProps {
  projectId: number;
  task: ProjectTask;
  members: ProjectMember[];
  onClose: () => void;
  onUpdate: (taskId: number, data: Partial<ProjectTask>) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  readOnly?: boolean;
}

export default function TaskDetailModal({ projectId, task, members, onClose, onUpdate, onDelete, readOnly }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState<number | null>(task.assigneeId);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [saving, setSaving] = useState(false);

  const hasChanges =
    title !== task.title ||
    description !== (task.description || "") ||
    status !== task.status ||
    priority !== task.priority ||
    assigneeId !== task.assigneeId ||
    startDate !== (task.startDate || "") ||
    dueDate !== (task.dueDate || "");

  const handleSave = async () => {
    if (!title.trim() || !hasChanges) return;
    setSaving(true);
    await onUpdate(task.id, {
      title: title.trim(),
      description: description || null,
      status,
      priority,
      assigneeId,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    await onDelete(task.id);
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Task details">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg sm:mx-4 bg-white dark:bg-slate-800 rounded-t-xl sm:rounded-xl shadow-xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
      >
        {/* Header: title, status, priority */}
        <TaskDetailHeader
          taskId={task.id}
          title={title}
          status={status}
          priority={priority}
          readOnly={readOnly}
          onTitleChange={setTitle}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onClose={onClose}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Body: assignee, dates, description, reactions, meta */}
          <TaskDetailBody
            projectId={projectId}
            task={task}
            description={description}
            assigneeId={assigneeId}
            startDate={startDate}
            dueDate={dueDate}
            members={members}
            readOnly={readOnly}
            onDescriptionChange={setDescription}
            onAssigneeChange={setAssigneeId}
            onStartDateChange={setStartDate}
            onDueDateChange={setDueDate}
          />

          {/* Work logs / comments */}
          <TaskDetailComments
            projectId={projectId}
            taskId={task.id}
          />

          {/* Transfer + footer actions */}
          <TaskDetailActions
            projectId={projectId}
            taskId={task.id}
            members={members}
            assigneeId={task.assigneeId}
            readOnly={readOnly}
            hasChanges={hasChanges}
            titleValid={!!title.trim()}
            saving={saving}
            onSave={handleSave}
            onClose={onClose}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
