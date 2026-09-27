import { Clock3, Target, CheckCircle2, Coffee, AlertTriangle } from 'lucide-react';
import type { TimeBlock } from '@timebox/shared';
import { useI18n } from '@/lib/useI18n';
import { analyzeDay, displayDuration } from './planning';

export default function SchedulerOverview({
  blocks,
  start,
  end,
  onRangeChange,
}: {
  blocks: TimeBlock[];
  start: number;
  end: number;
  onRangeChange: (start: number, end: number) => void;
}) {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const plan = analyzeDay(blocks, start, end);
  const percent = plan.planned ? Math.round((plan.completed / plan.planned) * 100) : 0;
  const label = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const tiles = [
    { icon: Clock3, label: ko ? '배치한 시간' : 'Time planned', value: plan.planned, tone: 'blue' },
    { icon: Target, label: ko ? '집중 시간' : 'Deep work', value: plan.focus, tone: 'violet' },
    {
      icon: Coffee,
      label: ko ? '비워 둔 시간' : 'Room to breathe',
      value: plan.capacity - plan.planned,
      tone: 'amber',
    },
    {
      icon: CheckCircle2,
      label: ko ? '완료한 시간' : 'Time completed',
      value: plan.completed,
      tone: 'emerald',
    },
  ];
  return (
    <section className="planner-overview" aria-label={ko ? '하루 시간 예산' : 'Daily time budget'}>
      <div className="planner-budget-header">
        <div>
          <span className="planner-eyebrow">{ko ? '하루 시간 예산' : 'YOUR DAY, AT A GLANCE'}</span>
          <p>
            {ko
              ? '할 일에 시간을 정하고, 여유도 남겨 두세요.'
              : 'Give your work a time. Leave space for life.'}
          </p>
        </div>
        <div className="planner-range">
          <span>{ko ? '계획 범위' : 'Planning window'}</span>
          <select
            aria-label={ko ? '계획 시작 시간' : 'Planning start'}
            value={start}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value < end) onRangeChange(value, end);
            }}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour * 60}>
                {label(hour * 60)}
              </option>
            ))}
          </select>
          <span>—</span>
          <select
            aria-label={ko ? '계획 종료 시간' : 'Planning end'}
            value={end}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value > start) onRangeChange(start, value);
            }}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={(hour + 1) * 60}>
                {label((hour + 1) * 60)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="planner-metrics">
        {tiles.map((tile) => (
          <div className={`planner-metric planner-metric-${tile.tone}`} key={tile.tone}>
            <div className="planner-metric-label">
              <tile.icon size={16} />
              <span>{tile.label}</span>
            </div>
            <strong>{displayDuration(tile.value, locale)}</strong>
          </div>
        ))}
      </div>
      <div className="planner-progress-label">
        <span>{ko ? '시간 기준 완료율' : 'Completion by time'}</span>
        <strong>{percent}%</strong>
      </div>
      <div
        className="planner-progress"
        role="progressbar"
        aria-label={ko ? '시간 기준 완료율' : 'Completion by time'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {plan.conflicts.size > 0 && (
        <p className="planner-conflict" role="status">
          <AlertTriangle size={15} />
          {ko
            ? `${plan.conflicts.size}개의 블록이 겹칩니다. 시간표에서 조정해 주세요.`
            : `${plan.conflicts.size} blocks overlap. Adjust them on the timeline.`}
        </p>
      )}
    </section>
  );
}
