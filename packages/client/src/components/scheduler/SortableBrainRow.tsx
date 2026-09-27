import { GripVertical, Check, Clock3, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/useI18n';
import { CATEGORY_CONFIG, type TimeBlock } from '@/stores/timeblockStore';
import type { BrainItem } from './elonStorage';

export default function SortableBrainRow({
  item,
  scheduledBlock,
  busy,
  onRemove,
  onToggleDone,
  onQuickSchedule,
  onCustomSchedule,
}: {
  item: BrainItem;
  scheduledBlock?: TimeBlock;
  busy?: boolean;
  onRemove: () => void;
  onToggleDone: () => void;
  onQuickSchedule: (duration: number) => void;
  onCustomSchedule: () => void;
}) {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
  const completed = scheduledBlock ? scheduledBlock.completed : item.done;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: config.color,
      }}
      className={cn('planner-task', isDragging && 'opacity-50', completed && 'is-complete')}
    >
      <div className="planner-task-main">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="planner-task-grip"
          aria-label={ko ? `${item.text} 순서 변경` : `Reorder ${item.text}`}
        >
          <GripVertical size={15} />
        </button>
        <button
          type="button"
          onClick={onToggleDone}
          className="planner-task-check"
          aria-label={ko ? `${item.text} 완료 표시` : `Mark ${item.text} complete`}
          aria-pressed={!!completed}
        >
          {completed && <Check size={13} />}
        </button>
        <div className="planner-task-title">
          <p>{item.text}</p>
          {item.notes && <span>{item.notes}</span>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="planner-task-remove"
          aria-label={ko ? `${item.text} 목록에서 제거` : `Remove ${item.text}`}
        >
          <X size={15} />
        </button>
      </div>
      <div className="planner-task-footer">
        <span className="planner-task-category" style={{ color: config.color }}>
          {config.icon} {config.label}
        </span>
        {scheduledBlock ? (
          <button type="button" className="planner-task-scheduled" onClick={onCustomSchedule}>
            {scheduledBlock.startTime}–{scheduledBlock.endTime}
            <Clock3 size={12} />
          </button>
        ) : (
          !completed && (
            <div className="planner-duration-buttons">
              {[15, 30, 45, 60].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  disabled={busy}
                  onClick={() => onQuickSchedule(duration)}
                  title={
                    ko
                      ? `빈 시간에 ${duration}분 바로 배치`
                      : `Place ${duration} minutes in a free slot`
                  }
                >
                  {duration}
                  {ko ? '분' : 'm'}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={onCustomSchedule}
                aria-label={ko ? '시간 직접 선택' : 'Choose a time'}
              >
                <Clock3 size={13} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
