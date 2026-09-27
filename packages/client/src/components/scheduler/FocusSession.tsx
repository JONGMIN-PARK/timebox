import { useEffect, useState } from 'react';
import { Play, Pause, Check, X, Timer } from 'lucide-react';
import type { TimeBlock } from '@timebox/shared';
import { useFocusStore } from '@/stores/focusStore';
import { useI18n } from '@/lib/useI18n';
import { localNow, todayDate } from '@/lib/dateUtils';
import { showToast } from '@/components/ui/Toast';
import { minuteOfDay } from './planning';

export default function FocusSession({
  blocks,
  date,
  onComplete,
  onGoToDate,
}: {
  blocks: TimeBlock[];
  date: string;
  onComplete: (id: number) => Promise<boolean>;
  onGoToDate: (date: string) => void;
}) {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const { session, start, pause, resume, reset } = useFocusStore();
  const [now, setNow] = useState(Date.now());
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    if (session?.deadline == null) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [session?.deadline]);
  const remaining = session
    ? Math.max(0, session.deadline === null ? session.remainingMs : session.deadline - now)
    : 0;
  useEffect(() => {
    if (session?.deadline != null && remaining === 0) {
      pause();
      showToast(
        'success',
        ko
          ? '집중 시간이 끝났습니다. 잠깐 쉬어 가세요.'
          : 'Focus time is complete. Take a short break.',
      );
    }
  }, [remaining, session?.deadline, pause, ko]);
  const time = localNow();
  const minute = time.getHours() * 60 + time.getMinutes();
  const unfinished = blocks.filter((block) => block.id > 0 && !block.completed);
  const active =
    date === todayDate()
      ? unfinished.find(
          (block) => minuteOfDay(block.startTime) <= minute && minuteOfDay(block.endTime) > minute,
        )
      : undefined;
  const next =
    active ??
    unfinished.find((block) => date !== todayDate() || minuteOfDay(block.startTime) >= minute) ??
    unfinished[0];
  const duration = next ? Math.max(1, minuteOfDay(next.endTime) - minuteOfDay(next.startTime)) : 25;
  const seconds = Math.ceil(remaining / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <section
      className={`planner-focus ${session ? 'is-active' : ''}`}
      aria-label={ko ? '집중 타이머' : 'Focus timer'}
    >
      <div className="planner-focus-icon">
        <Timer size={21} />
      </div>
      <div className="planner-focus-copy">
        <span>
          {session
            ? ko
              ? '지금은 이 일에만 집중'
              : 'ONE THING AT A TIME'
            : ko
              ? '다음 집중할 일'
              : 'YOUR NEXT FOCUS'}
        </span>
        <strong>
          {session?.title ??
            next?.title ??
            (ko ? '시간표에 첫 블록을 배치해 보세요' : 'Plan your first block to get started')}
        </strong>
        {!session && next && (
          <small>
            {next.startTime}–{next.endTime} · {duration}
            {ko ? '분' : 'm'}
          </small>
        )}
      </div>
      {session ? (
        <>
          <output
            className="planner-focus-clock"
            aria-label={ko ? '남은 집중 시간' : 'Focus time remaining'}
          >
            {clock}
          </output>
          {session.date !== date ? (
            <button
              type="button"
              className="planner-focus-action"
              onClick={() => onGoToDate(session.date)}
            >
              {ko ? '집중 날짜로' : 'Go to session'}
            </button>
          ) : (
            <>
              {remaining > 0 && (
                <button
                  type="button"
                  className="planner-focus-action"
                  aria-label={
                    session.deadline === null
                      ? ko
                        ? '집중 재개'
                        : 'Resume focus'
                      : ko
                        ? '집중 일시정지'
                        : 'Pause focus'
                  }
                  onClick={session.deadline === null ? resume : pause}
                >
                  {session.deadline === null ? <Play size={15} /> : <Pause size={15} />}
                </button>
              )}
              <button
                type="button"
                className="planner-focus-action"
                disabled={completing}
                onClick={async () => {
                  setCompleting(true);
                  try {
                    if (await onComplete(session.blockId)) reset();
                  } finally {
                    setCompleting(false);
                  }
                }}
              >
                <Check size={15} />
                {ko ? '완료' : 'Done'}
              </button>
            </>
          )}
          <button
            type="button"
            className="planner-focus-reset"
            aria-label={ko ? '집중 타이머 종료' : 'End focus session'}
            onClick={reset}
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="planner-focus-action"
          disabled={!next}
          onClick={() => {
            if (next) start(next, duration);
          }}
        >
          <Play size={14} fill="currentColor" />
          {ko ? '집중 시작' : 'Start focus'}
        </button>
      )}
    </section>
  );
}
