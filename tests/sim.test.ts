import { describe, expect, it } from 'vitest';
import { COFFEE_ENERGY, MAX_STRIKES, PLAYER_RADIUS, RUN_SECONDS, STEP } from '../src/core/constants';
import { createWorld, officeClock, performanceReview, step } from '../src/core/sim';
import type { Input } from '../src/core/types';
import { isSolidAt } from '../src/levels/office';
import { stun } from '../src/player/player';
import { playRun } from './bot';

const still: Input = { moveX: 0, moveY: 0, dash: false };

describe('simulation', () => {
  it('replays the same run from the same seed', () => {
    const a = playRun(42, 'casual');
    const b = playRun(42, 'casual');
    expect(a.score).toBe(b.score);
    expect(a.stats).toEqual(b.stats);
    expect(a.time).toBe(b.time);
  });

  it('runs from 09:00 to 17:00', () => {
    expect(officeClock(0)).toBe('09:00');
    expect(officeClock(RUN_SECONDS / 2)).toBe('13:00');
    expect(officeClock(RUN_SECONDS)).toBe('17:00');
  });

  it('ends at clock-out', () => {
    const world = createWorld(1);
    world.boss.timer = 9999;
    world.player.strikes = 0;
    const steps = Math.ceil(RUN_SECONDS / STEP) + 2;
    for (let i = 0; i < steps; i++) {
      world.meetings.length = 0;
      world.events.length = 0;
      step(world, still);
    }
    expect(world.phase).toBe('over');
    expect(world.endReason).toBe('clocked-out');
    expect(world.time).toBeCloseTo(RUN_SECONDS, 0);
  });

  it('fires you on the third strike', () => {
    const world = createWorld(2);
    world.player.strikes = MAX_STRIKES;
    step(world, still);
    expect(world.endReason).toBe('fired');
    expect(performanceReview(world).stamp).toBe('FIRED');
  });

  it('completes a task you stand next to, and pays for it', () => {
    const world = createWorld(3);
    const task = world.tasks[0];
    if (!task) throw new Error('expected a task');
    world.player.x = task.x;
    world.player.y = task.y;
    for (let i = 0; i < 120 && world.stats.tasks === 0; i++) step(world, still);
    expect(world.stats.tasks).toBe(1);
    expect(world.score).toBeGreaterThanOrEqual(task.value);
    expect(world.combo).toBe(2);
  });

  it('refills energy with coffee and makes you wired', () => {
    const world = createWorld(4);
    world.player.energy = 10;
    step(world, still);
    const cup = world.coffees[0];
    if (!cup) throw new Error('expected a cup');
    world.player.x = cup.x;
    world.player.y = cup.y;
    step(world, still);
    expect(world.stats.coffees).toBe(1);
    expect(world.player.energy).toBeGreaterThan(COFFEE_ENERGY);
    expect(world.player.wiredT).toBeGreaterThan(0);
  });

  it('pulls you into a meeting and resets your combo', () => {
    const world = createWorld(5);
    world.combo = 4;
    world.comboT = 5;
    world.meetings.push({ id: 900, x: world.player.x, y: world.player.y, vx: 0, vy: 0, title: 'TEST', brushed: false, frozenT: 0 });
    step(world, still);
    expect(world.player.stunT).toBeGreaterThan(0);
    expect(world.combo).toBe(1);
    expect(world.stats.meetings).toBe(1);
  });

  it('dashes through a meeting without stopping', () => {
    const world = createWorld(6);
    step(world, { moveX: 1, moveY: 0, dash: true });
    world.meetings.push({ id: 901, x: world.player.x + 3, y: world.player.y, vx: 0, vy: 0, title: 'TEST', brushed: false, frozenT: 0 });
    step(world, { moveX: 1, moveY: 0, dash: false });
    expect(world.stats.meetings).toBe(0);
  });

  it('holds you still while stunned', () => {
    const world = createWorld(7);
    stun(world, 1, 'TEST');
    const { x, y } = world.player;
    step(world, { moveX: 1, moveY: 1, dash: true });
    expect(world.player.x).toBe(x);
    expect(world.player.y).toBe(y);
  });
});

describe('a headless game, start to finish', () => {
  it('stays sane on every step across many seeds', () => {
    for (let seed = 0; seed < 12; seed++) {
      const world = createWorld(seed * 7919 + 1);
      for (let i = 0; i < 6000 && world.phase === 'playing'; i++) {
        world.events.length = 0;
        const t = i / 60;
        step(world, { moveX: Math.sin(t * (1 + seed / 5)), moveY: Math.cos(t * 1.7), dash: i % 97 === 0 });
        const p = world.player;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(isSolidAt(world.office, p.x, p.y), `player in a wall at step ${i}`).toBe(false);
        expect(isSolidAt(world.office, p.x - PLAYER_RADIUS, p.y - PLAYER_RADIUS)).toBe(false);
        expect(Number.isFinite(world.boss.x) && Number.isFinite(world.boss.y)).toBe(true);
        expect(p.energy).toBeGreaterThanOrEqual(0);
        expect(world.score).toBeGreaterThanOrEqual(0);
        expect(world.tasks.length).toBeLessThanOrEqual(6);
      }
      expect(world.phase).toBe('over');
    }
  }, 60_000);

  it('rewards playing over standing around', () => {
    const seeds = Array.from({ length: 14 }, (_, i) => 1000 + i);
    const median = (style: 'idle' | 'casual' | 'careful'): number => {
      const scores = seeds.map((s) => playRun(s, style).score).sort((a, b) => a - b);
      return scores[Math.floor(scores.length / 2)] as number;
    };
    expect(median('idle')).toBe(0);
    expect(median('casual')).toBeGreaterThan(1500);
    expect(median('careful')).toBeGreaterThan(1500);
  }, 60_000);

  it('never pays out more than a run could earn', () => {
    for (let seed = 0; seed < 10; seed++) {
      const world = playRun(5000 + seed, 'greedy');
      const ceiling = world.stats.tasks * 1650 + world.stats.nearMisses * 125;
      expect(world.score).toBeLessThanOrEqual(ceiling);
    }
  }, 60_000);
});
