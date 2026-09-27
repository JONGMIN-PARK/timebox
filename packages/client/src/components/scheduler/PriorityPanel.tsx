import { Clock3, Target, Check } from 'lucide-react';
import type { TimeBlock } from '@timebox/shared';
import { useI18n } from '@/lib/useI18n';
import { parseBlockMeta, type Top3Tuple } from './elonStorage';

export default function PriorityPanel({
  priorities,
  blocks,
  onChange,
  onSchedule,
}: {
  priorities: Top3Tuple;
  blocks: TimeBlock[];
  onChange: (value: Top3Tuple) => void;
  onSchedule: (slot: 1 | 2 | 3, title: string) => void;
}) {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  return (
    <section className="planner-card planner-priorities">
      <div className="planner-section-heading">
        <span className="planner-section-icon">
          <Target size={18} />
        </span>
        <div>
          <h3>{ko ? '오늘 꼭 끝낼 3가지' : 'Your three priorities'}</h3>
          <p>{ko ? '중요한 일부터 시간을 확보하세요.' : 'Make room for what matters first.'}</p>
        </div>
      </div>
      <div className="planner-priority-list">
        {([1, 2, 3] as const).map((slot) => {
          const block = blocks.find((block) => parseBlockMeta(block.meta).prioritySlot === slot);
          return (
            <div className="planner-priority" key={slot}>
              <span className={`planner-priority-number ${block?.completed ? 'is-complete' : ''}`}>
                {block?.completed ? <Check size={15} /> : String(slot).padStart(2, '0')}
              </span>
              <div className="planner-priority-input">
                <input
                  aria-label={ko ? `우선순위 ${slot}` : `Priority ${slot}`}
                  value={priorities[slot - 1]}
                  placeholder={
                    ko ? '가장 중요한 일을 적어 보세요' : 'What would make today a good day?'
                  }
                  onChange={(event) => {
                    const next = [...priorities] as Top3Tuple;
                    next[slot - 1] = event.target.value;
                    onChange(next);
                  }}
                />
                {block && (
                  <span>
                    {block.startTime}–{block.endTime}
                    {block.completed
                      ? ko
                        ? ' · 완료'
                        : ' · Done'
                      : ko
                        ? ' · 배치됨'
                        : ' · Planned'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="planner-icon-button"
                aria-label={ko ? `우선순위 ${slot} 시간 배치` : `Schedule priority ${slot}`}
                title={ko ? '시간 배치' : 'Schedule'}
                disabled={!priorities[slot - 1].trim()}
                onClick={() => onSchedule(slot, priorities[slot - 1])}
              >
                <Clock3 size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
