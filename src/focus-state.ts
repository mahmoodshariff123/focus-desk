export const TASK_COUNT = 3;
export const DURATIONS = [5, 10, 25] as const;

const STORAGE_KEY = 'focus-desk-state-v1';

const TASK_POOL = [
  'Drink a glass of water',
  "Write today's top goal",
  'Clear your desk',
  'Reply to one message',
  'Stretch for 1 minute',
  'Plan your lunch break',
  'Read 2 pages of a book',
  'Tidy your inbox',
  'Take 5 deep breaths',
  'Note 3 good things',
  'Review your calendar',
  'Open a window',
];

export interface FocusTask {
  label: string;
  done: boolean;
}

export interface FocusState {
  day: string;
  tasks: FocusTask[];
  durationMin: number;
  focusDone: boolean;
  focusMinutesToday: number;
  streak: number;
  lastCompleteDay: string | null;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function today(): string {
  return dayKey(new Date());
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

function pickTasks(count: number, exclude: string[] = []): FocusTask[] {
  const pool = TASK_POOL.filter((label) => !exclude.includes(label));
  const picked: FocusTask[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push({ label: pool.splice(index, 1)[0]!, done: false });
  }
  return picked;
}

function freshDay(previous?: FocusState): FocusState {
  const last = previous?.lastCompleteDay ?? null;
  const keepStreak = last === today() || last === yesterday();
  return {
    day: today(),
    tasks: pickTasks(TASK_COUNT),
    durationMin: previous?.durationMin ?? 10,
    focusDone: false,
    focusMinutesToday: 0,
    streak: keepStreak ? (previous?.streak ?? 0) : 0,
    lastCompleteDay: last,
  };
}

export function loadState(): FocusState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw != null) {
      const saved = JSON.parse(raw) as FocusState;
      if (saved.day === today() && Array.isArray(saved.tasks)) return saved;
      return freshDay(saved);
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return freshDay();
}

export function saveState(state: FocusState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); the session still works.
  }
}

export function doneCount(state: FocusState): number {
  return state.tasks.filter((task) => task.done).length;
}

export function isDayComplete(state: FocusState): boolean {
  return state.focusDone && doneCount(state) === state.tasks.length;
}

/** Returns true the first time today's morning is completed. */
export function markDayComplete(state: FocusState): boolean {
  if (state.lastCompleteDay === state.day) return false;
  state.streak += 1;
  state.lastCompleteDay = state.day;
  return true;
}

/** Swaps every unfinished task for a new one. */
export function shuffleTasks(state: FocusState): void {
  const fresh = pickTasks(TASK_COUNT, state.tasks.map((task) => task.label));
  state.tasks = state.tasks.map((task) => (task.done ? task : (fresh.pop() ?? task)));
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
