import { describe, expect, it } from 'vitest';
import { COMBO_MAX, LUNCH_AT, POWER_SECONDS, RUN_SECONDS, STEP } from '../src/core/constants';
import { createWorld, endingScene, performanceReview, step } from '../src/core/sim';
import type { GameEvent, Input, TaskKind, World } from '../src/core/types';
import { wantedMeetings } from '../src/enemies/meetings';
import { TASK_SPECS } from '../src/items/tasks';

const still: Input = { moveX: 0, moveY: 0, dash: false };

function taskFor(world: World, kind: TaskKind, value = TASK_SPECS[kind].value): void {
  const { need } = TASK_SPECS[kind];
  world.tasks = [{ id: 800, kind, x: world.player.x, y: world.player.y, life: 99, maxLife: 99, work: 0, need, value }];
}

// Better than anyone could play: teleports onto everything, always wired, always at top combo.
function cheat(seed: number): World {
  const world = createWorld(seed);
  world.rush = true;
  for (let i = 0; i < Math.ceil(100 / STEP) && world.phase === 'playing'; i++) {
    const goal = world.powerups[0] ?? world.tasks[0] ?? world.meetings[0];
    if (goal) Object.assign(world.player, { x: goal.x, y: goal.y });
    Object.assign(world.player, { wiredT: 4, energy: 100, strikes: 0 });
    world.combo = COMBO_MAX;
    world.comboT = 5;
    world.events.length = 0;
    step(world, { moveX: i % 2 ? 1 : -1, moveY: 0, dash: i % 40 === 0 });
    expect(world.score).toBeLessThanOrEqual(world.stats.tasks * 1650 + world.stats.nearMisses * 125);
  }
  return world;
}

describe('the score ceiling', () => {
  it('pays the best tasks exactly the most the site accepts, and caps anything larger', () => {
    for (const [kind, value, combo] of [['urgent', 220, COMBO_MAX], ['project', 220, COMBO_MAX], ['email', 99999, 50]] as const) {
      const world = createWorld(1);
      Object.assign(world, { rush: true, combo, comboT: 5 });
      taskFor(world, kind, value);
      for (let i = 0; i < 200 && world.stats.tasks === 0; i++) step(world, still);
      expect(world.score).toBe(1650);
    }
  });

  it('holds on every step, with every item, for a perfect cheat', () => {
    for (let seed = 0; seed < 12; seed++) {
      const world = cheat(seed * 131 + 7);
      expect(world.stats.tasks).toBeGreaterThan(40);
      expect(world.stats.tasks / world.time).toBeLessThanOrEqual(2);
      expect(world.stats.nearMisses / world.time).toBeLessThanOrEqual(2);
      expect(world.time).toBeLessThanOrEqual(95);
    }
  }, 60_000);
});

describe('tasks and power-ups', () => {
  it('moves the combo two steps for a project', () => {
    const world = createWorld(3);
    taskFor(world, 'project');
    for (let i = 0; i < 200 && world.stats.tasks === 0; i++) step(world, still);
    expect(world.combo).toBe(3);
  });

  it('lets headphones walk you through a meeting', () => {
    const world = createWorld(4);
    world.player.quietT = POWER_SECONDS;
    world.meetings.push({ id: 900, x: world.player.x, y: world.player.y, vx: 0, vy: 0, title: 'TEST', brushed: false });
    step(world, still);
    expect(world.stats.meetings).toBe(0);
  });

  it('pays nothing for a pickup, and an auto-reply calls off the boss', () => {
    const world = createWorld(5);
    Object.assign(world.boss, { state: 'chase', x: world.player.x + 40, y: world.player.y, lostT: 5, timer: 5 });
    world.powerups.push({ id: 900, kind: 'auto-reply', x: world.player.x, y: world.player.y, life: 5 });
    step(world, still);
    step(world, still);
    expect(world.boss.state).toBe('patrol');
    expect(world.powerups).toHaveLength(0);
    expect(world.score).toBe(0);
  });

  it('goes quiet at lunch', () => {
    expect(wantedMeetings(LUNCH_AT + 1)).toBeLessThan(wantedMeetings(LUNCH_AT - 1));
  });
});

describe('the ending', () => {
  function runToTheEnd(world: World): GameEvent[] {
    world.boss.timer = 9999;
    for (let i = 0; i < Math.ceil(RUN_SECONDS / STEP) + 5; i++) {
      world.meetings.length = 0;
      step(world, still);
    }
    return world.events;
  }

  it('clocks you out once, at 17:00, and stops the clock', () => {
    const world = createWorld(8);
    const events = runToTheEnd(world);
    expect(events.filter((e) => e.type === 'over')).toEqual([{ type: 'over', reason: 'clocked-out' }]);
    expect(events.filter((e) => e.type === 'beat')).toHaveLength(3);
    expect(world.time).toBeCloseTo(RUN_SECONDS, 0);
    expect(world.time).toBeLessThanOrEqual(95);
  });

  it('gives clocking out its own moment, apart from being fired', () => {
    const clean = createWorld(9);
    runToTheEnd(clean);
    const fired = createWorld(10);
    fired.player.strikes = 3;
    step(fired, still);
    expect(endingScene(clean).title).toBe('CLOCKED OUT');
    expect(endingScene(fired).title).toBe('FIRED');
    expect(endingScene(clean).seconds).toBeGreaterThan(endingScene(fired).seconds);
    expect(performanceReview(clean).stamp).not.toBe('FIRED');
  });
});
