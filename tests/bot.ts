import { STEP } from '../src/core/constants';
import { createWorld, step } from '../src/core/sim';
import type { Input, World } from '../src/core/types';
import { distanceField, nextStep, type Point } from '../src/levels/office';

export type BotStyle = 'idle' | 'casual' | 'greedy' | 'careful';

function chooseGoal(world: World, style: BotStyle): Point | null {
  const p = world.player;
  if (world.player.energy < 35 || (style === 'greedy' && world.player.energy < 55)) {
    const cup = [...world.coffees].sort(
      (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
    if (cup) return cup;
  }
  const score = (t: { x: number; y: number; value: number; life: number }): number => {
    const dist = Math.hypot(t.x - p.x, t.y - p.y);
    return dist - (style === 'greedy' ? t.value * 0.3 : 0) + (t.life < 4 ? -30 : 0);
  };
  return [...world.tasks].sort((a, b) => score(a) - score(b))[0] ?? null;
}

// What a person does once they've seen the boss turn around: run the other way.
function fleeBoss(world: World): Input | null {
  const { boss, player: p } = world;
  const dist = Math.hypot(boss.x - p.x, boss.y - p.y);
  const hunting = boss.state === 'chase' || boss.state === 'alert';
  if (!hunting || dist > 80) return null;
  return {
    moveX: Math.sign(Math.round(p.x - boss.x)),
    moveY: Math.sign(Math.round(p.y - boss.y)),
    dash: dist < 24,
  };
}

// A plain bot that walks to work and dashes through trouble. It stands in for a player
// in tests and in the balance numbers quoted in GAME.md.
export function botInput(world: World, style: BotStyle): Input {
  if (style === 'idle') return { moveX: 0, moveY: 0, dash: false };
  const p = world.player;
  if (style === 'careful') {
    const away = fleeBoss(world);
    if (away) return away;
  }
  const goal = chooseGoal(world, style);
  if (!goal) return { moveX: 0, moveY: 0, dash: false };
  const field = distanceField(world.office, goal.x, goal.y);
  const next = nextStep(field, p.x, p.y);
  const target = next ?? goal;
  const threatened =
    world.meetings.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 22) ||
    (world.boss.state === 'chase' && Math.hypot(world.boss.x - p.x, world.boss.y - p.y) < 26);
  return {
    moveX: Math.sign(Math.round(target.x - p.x)),
    moveY: Math.sign(Math.round(target.y - p.y)),
    dash: threatened && (style !== 'casual' || world.rng.next() < 0.02),
  };
}

export function playRun(seed: number, style: BotStyle): World {
  const world = createWorld(seed);
  const maxSteps = Math.ceil(100 / STEP);
  for (let i = 0; i < maxSteps && world.phase === 'playing'; i++) {
    world.events.length = 0;
    step(world, botInput(world, style));
  }
  return world;
}
