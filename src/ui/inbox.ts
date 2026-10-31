export interface HallEntry {
  task: string;
  by: string;
}

export type PageMessage = { type: 'daily'; day: number } | { type: 'hall'; bosses: HallEntry[] };

const MAX_DAY = 100000;
const MAX_BOSSES = 40;
const MAX_TASK_CHARS = 60;
const MAX_BY_CHARS = 24;

const hasOnly = (value: unknown, count: number): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === count;

// Capped first, so a huge string costs nothing. Blank text counts as junk.
function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.slice(0, max).replace(/\s+/g, ' ').trim();
  return text || null;
}

function readBosses(list: unknown): HallEntry[] | null {
  if (!Array.isArray(list)) return null;
  const bosses: HallEntry[] = [];
  for (const entry of list.slice(0, MAX_BOSSES)) {
    if (!hasOnly(entry, 2)) return null;
    const task = clean(entry.task, MAX_TASK_CHARS);
    const by = clean(entry.by, MAX_BY_CHARS);
    if (!task || !by) return null;
    bosses.push({ task, by });
  }
  return bosses;
}

// Anything that isn't exactly one of the two shapes is ignored.
export function readMessage(data: unknown): PageMessage | null {
  if (!hasOnly(data, 3) || data.source !== 'agent-intern-site') return null;
  if (data.type === 'daily') {
    const { day } = data;
    return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= MAX_DAY ? { type: 'daily', day } : null;
  }
  if (data.type === 'hall') {
    const bosses = readBosses(data.bosses);
    return bosses ? { type: 'hall', bosses } : null;
  }
  return null;
}

export function listenToPage(origin: string, handle: (message: PageMessage) => void): void {
  window.addEventListener('message', (event) => {
    if (event.origin !== origin) return;
    const message = readMessage(event.data);
    if (message) handle(message);
  });
}
