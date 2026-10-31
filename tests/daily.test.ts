import { describe, expect, it } from 'vitest';
import { STEP } from '../src/core/constants';
import { dailySeed, dayNumber, EPOCH_UTC } from '../src/core/daily';
import { createWorld, step } from '../src/core/sim';

const DAY_MS = 86400000;

// Everything that appears in a run, in order, with where and when.
function timeline(seed: number): string[] {
  const world = createWorld(seed);
  const log: string[] = [];
  const seen = new Set<number>();
  const note = (tag: string, item: { id: number; x: number; y: number }): void => {
    if (!seen.has(item.id)) log.push(`${world.time.toFixed(3)} ${tag} ${item.x} ${item.y}`);
    seen.add(item.id);
  };
  for (let i = 0; i < Math.ceil(100 / STEP) && world.phase === 'playing'; i++) {
    step(world, { moveX: Math.sin(i / 40), moveY: Math.cos(i / 55), dash: i % 180 === 0 });
    for (const task of world.tasks) note(task.kind, task);
    for (const meeting of world.meetings) note(meeting.title, meeting);
    for (const item of world.powerups) note(item.kind, item);
    for (const event of world.events) log.push(`${world.time.toFixed(3)} ${event.type}`);
    world.events.length = 0;
  }
  log.push(`end ${world.score} ${world.player.x} ${world.player.y} ${world.endReason}`);
  return log;
}

describe('the daily shift', () => {
  it('counts days from the epoch in UTC', () => {
    expect(EPOCH_UTC).toBe(1793404800000);
    expect(dayNumber(EPOCH_UTC + DAY_MS - 1)).toBe(1);
    expect(dayNumber(EPOCH_UTC + DAY_MS)).toBe(2);
  });

  it('matches the seeds the site computes', () => {
    const vectors: [number, number][] = [
      [1, 19218948], [2, 595380439], [3, 1169446566], [30, 361920779], [365, 168475368], [1000, 396452061],
    ];
    for (const [day, seed] of vectors) expect(dailySeed(day)).toBe(seed);
  });

  it('gives the same office and the same timeline for the same inputs', () => {
    const seed = dailySeed(12);
    const a = timeline(seed);
    expect(a.length).toBeGreaterThan(40);
    expect(createWorld(seed).office).toEqual(createWorld(seed).office);
    expect(timeline(seed)).toEqual(a);
    expect(timeline(dailySeed(13))).not.toEqual(a);
  });
});
