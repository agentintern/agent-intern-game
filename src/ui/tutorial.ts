import { WORK_RADIUS } from '../core/constants';
import type { World } from '../core/types';
import { drawTextCentered, textWidth } from './font';
import { HIGHLIGHT, INK, PAPER } from './palette';
import { nearest } from './render';
import { toHud, type Camera, type View } from './stage';

interface Lesson {
  text: string;
  touch?: string;
  seconds: number;
  target?: 'task' | 'cup';
  done: (world: World) => boolean;
}

function nearTask(world: World): boolean {
  const task = nearest(world.tasks, world.player.x, world.player.y);
  return !!task && Math.hypot(task.x - world.player.x, task.y - world.player.y) < WORK_RADIUS;
}

// Each lesson ends when you do the thing, or runs out by itself if you already know how.
const LESSONS: readonly Lesson[] = [
  { text: 'ARROW KEYS: WALK TO A TASK', touch: 'DRAG TO WALK TO A TASK', seconds: 12, target: 'task', done: nearTask },
  { text: 'STAY CLOSE UNTIL THE RING FILLS', seconds: 9, target: 'task', done: (w) => w.stats.tasks > 0 },
  { text: 'NOW GRAB A COFFEE', seconds: 10, target: 'cup', done: (w) => w.stats.coffees > 0 },
  { text: 'SPACE: DASH THROUGH TROUBLE', touch: 'DASH BUTTON: GO THROUGH TROUBLE', seconds: 7, done: (w) => w.player.dashT > 0 },
];

// First run after load only. It only reads the world, so a daily plays the same with or without it.
export class Tutorial {
  private index = LESSONS.length;
  private left = 0;
  private seen = false;

  get active(): boolean {
    return this.index < LESSONS.length;
  }

  begin(): void {
    if (this.seen) this.index = LESSONS.length;
    else this.index = this.left = 0;
    this.seen = true;
  }

  update(world: World, dt: number): void {
    const lesson = LESSONS[this.index];
    if (!lesson) return;
    this.left += dt;
    if (lesson.done(world) || this.left > lesson.seconds) {
      this.index++;
      this.left = 0;
    }
  }

  draw(view: View, camera: Camera, world: World, touch: boolean): void {
    const lesson = LESSONS[this.index];
    if (!lesson) return;
    const { ctx, width } = view;
    const p = world.player;
    const text = (touch && lesson.touch) || lesson.text;
    const half = Math.ceil(textWidth(text) / 2) + 4;
    const at = toHud(view, camera, p.x, p.y, 36);
    const x = Math.round(Math.max(half + 2, Math.min(width - half - 2, at.x)));
    const y = Math.max(30, Math.round(at.y) - 14);
    ctx.fillStyle = INK;
    ctx.fillRect(x - half - 1, y - 1, half * 2 + 2, 13);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x - half, y, half * 2, 11);
    drawTextCentered(ctx, text, x, y + 2, INK);

    const goal = lesson.target === 'task' ? nearest(world.tasks, p.x, p.y) : lesson.target === 'cup' ? nearest(world.coffees, p.x, p.y) : null;
    if (!goal) return;
    const mark = toHud(view, camera, goal.x, goal.y, 42);
    const gx = Math.round(mark.x);
    const gy = Math.round(mark.y) + Math.round(Math.sin(world.time * 8) * 2);
    ctx.fillStyle = HIGHLIGHT;
    for (let row = 0; row < 5; row++) ctx.fillRect(gx - 4 + row, gy + row, 9 - row * 2, 1);
  }
}
