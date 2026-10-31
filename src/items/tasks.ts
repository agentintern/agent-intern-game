import { COMBO_MAX, COMBO_SECONDS, isLunch, MAX_TASK_POINTS, RUSH_MULTIPLIER, RUN_SECONDS, STEP, WORK_RADIUS, WIRED_FACTOR } from '../core/constants';
import type { Task, TaskKind, World } from '../core/types';
import type { Point } from '../levels/office';

interface TaskSpec {
  need: number;
  life: number;
  value: number;
  steps?: number;
}

export const TASK_SPECS: Record<TaskKind, TaskSpec> = {
  email: { need: 0.5, life: 15, value: 50 },
  sheet: { need: 0.9, life: 17, value: 90 },
  report: { need: 1.4, life: 20, value: 140 },
  urgent: { need: 0.8, life: 8, value: 220 },
  call: { need: 0.35, life: 6, value: 120 },
  project: { need: 2.2, life: 22, value: 220, steps: 2 },
};

const MAX_OPEN_TASKS = 6;

export function taskInterval(world: World): number {
  if (world.rush) return 1.05;
  const interval = 2.6 - (world.time / RUN_SECONDS) * 1.1;
  return isLunch(world.time) ? interval * 1.5 : interval;
}

function pickKind(world: World): TaskKind {
  const roll = world.rng.next();
  if (world.time > 40 && roll < 0.1) return 'project';
  if (world.time > 25 && roll < 0.26) return 'urgent';
  if (world.time > 12 && roll < 0.38) return 'call';
  if (roll < 0.5) return 'email';
  if (roll < 0.78) return 'sheet';
  return 'report';
}

function freeSpot(world: World): Point | null {
  const { rng, office, tasks, player } = world;
  for (let attempt = 0; attempt < 30; attempt++) {
    const spot = rng.pick(office.taskSpots);
    if (tasks.some((t) => t.x === spot.x && t.y === spot.y)) continue;
    const dist = Math.hypot(spot.x - player.x, spot.y - player.y);
    // The opening tasks sit close, so the first one is a second away.
    if (dist < 40 || (world.time === 0 && dist > 130)) continue;
    return spot;
  }
  return null;
}

export function spawnTask(world: World): void {
  const spot = freeSpot(world);
  if (!spot) return;
  const kind = pickKind(world);
  const spec = TASK_SPECS[kind];
  world.tasks.push({
    id: world.nextId++,
    kind,
    x: spot.x,
    y: spot.y,
    life: spec.life,
    maxLife: spec.life,
    work: 0,
    need: spec.need,
    value: spec.value,
  });
}

function nearestTask(world: World): Task | null {
  const { player: p } = world;
  let best: Task | null = null;
  let bestDist = WORK_RADIUS;
  for (const task of world.tasks) {
    const d = Math.hypot(task.x - p.x, task.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = task;
    }
  }
  return best;
}

function complete(world: World, task: Task): void {
  const rush = world.rush ? RUSH_MULTIPLIER : 1;
  const points = Math.min(MAX_TASK_POINTS, Math.round(task.value * world.combo * rush));
  world.score += points;
  world.stats.tasks++;
  world.events.push({ type: 'task', x: task.x, y: task.y, points, combo: world.combo, kind: task.kind });
  world.combo = Math.min(COMBO_MAX, world.combo + (TASK_SPECS[task.kind].steps ?? 1));
  world.comboT = COMBO_SECONDS;
  world.stats.bestCombo = Math.max(world.stats.bestCombo, world.combo);
}

export function stepTasks(world: World): void {
  const p = world.player;

  world.taskT -= STEP;
  if (world.taskT <= 0 && world.tasks.length < MAX_OPEN_TASKS) {
    spawnTask(world);
    world.taskT = taskInterval(world);
  }

  if (world.comboT > 0) {
    world.comboT -= STEP;
    if (world.comboT <= 0) world.combo = 1;
  }

  const active = p.stunT <= 0 && p.dashT <= 0 ? nearestTask(world) : null;
  for (let i = world.tasks.length - 1; i >= 0; i--) {
    const task = world.tasks[i] as Task;
    if (task === active) {
      const before = Math.floor(task.work * 6);
      task.work += STEP * (p.wiredT > 0 ? WIRED_FACTOR : 1);
      if (Math.floor(task.work * 6) !== before) world.events.push({ type: 'task-tick', x: task.x, y: task.y });
      if (task.work >= task.need) {
        complete(world, task);
        world.tasks.splice(i, 1);
        continue;
      }
    } else {
      task.work = Math.max(0, task.work - STEP * 0.5);
    }
    task.life -= STEP;
    if (task.life <= 0) {
      world.stats.missed++;
      world.events.push({ type: 'task-missed', x: task.x, y: task.y });
      world.combo = Math.max(1, world.combo - 1);
      world.tasks.splice(i, 1);
    }
  }
}
