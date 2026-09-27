import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface FocusSession {
  blockId: number;
  date: string;
  title: string;
  durationMs: number;
  remainingMs: number;
  deadline: number | null;
}
interface FocusState {
  session: FocusSession | null;
  start: (block: { id: number; date: string; title: string }, minutes: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

/** Use a deadline rather than tick counts, so background tabs keep accurate time. */
export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      session: null,
      start: (block, minutes) => {
        const durationMs = minutes * 60_000;
        set({
          session: {
            blockId: block.id,
            date: block.date,
            title: block.title,
            durationMs,
            remainingMs: durationMs,
            deadline: Date.now() + durationMs,
          },
        });
      },
      pause: () => {
        const session = get().session;
        if (session?.deadline !== null && session)
          set({
            session: {
              ...session,
              remainingMs: Math.max(0, session.deadline! - Date.now()),
              deadline: null,
            },
          });
      },
      resume: () => {
        const session = get().session;
        if (session && session.remainingMs > 0)
          set({ session: { ...session, deadline: Date.now() + session.remainingMs } });
      },
      reset: () => set({ session: null }),
    }),
    {
      name: 'timebox-focus-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
