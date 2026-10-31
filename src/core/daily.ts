// The site runs this same formula to recognize a daily run by its seed. Change them together.
export const EPOCH_UTC = Date.UTC(2026, 9, 31);

export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs - EPOCH_UTC) / 86400000) + 1;
}

export function dailySeed(day: number): number {
  return (Math.imul(day, 2654435761 | 0) ^ 0x1f123bb5) & 0x7fffffff;
}
