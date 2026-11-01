import { RUN_SECONDS } from '../core/constants';
import type { World } from '../core/types';
import { drawTextCentered, wrapText } from './font';
import { INK, PAPER, STAMP, VIOLET } from './palette';

// What the screen does, whatever the world looks like.
interface Flat {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function nearest<T extends { x: number; y: number }>(items: readonly T[], x: number, y: number, skip: T | null = null): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const dist = Math.hypot(item.x - x, item.y - y);
    if (dist < bestDist && item !== skip) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

// The day passes: a clear morning turns to a low orange sun, then to dusk.
export function drawDaylight(view: Flat, world: World): void {
  const t = Math.min(1, world.time / RUN_SECONDS);
  const { ctx, width, height } = view;
  if (t < 0.45) return;
  const dusk = (t - 0.45) / 0.55;
  ctx.fillStyle = '#d6683a';
  ctx.globalAlpha = dusk * 0.22;
  ctx.fillRect(0, 0, width, height);
  if (dusk > 0.7) {
    ctx.fillStyle = '#24184a';
    ctx.globalAlpha = ((dusk - 0.7) / 0.3) * 0.26;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalAlpha = 1;
}

export function drawStunCard(view: Flat, world: World): void {
  const { ctx, width, height } = view;
  const p = world.player;
  if (p.stunT <= 0 || world.phase === 'over') return;
  const lines = wrapText(p.stunText, Math.floor((width - 40) / 6));
  const boxH = 18 + lines.length * 10;
  const y = Math.round(height * 0.68);
  const x = 12;
  ctx.fillStyle = INK;
  ctx.fillRect(x - 2, y - 2, width - 20, boxH + 4);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, width - 24, boxH);
  const heading = p.stunBy === 'boss' ? 'THE BOSS SAYS' : 'YOU ARE NOW IN A MEETING';
  drawTextCentered(ctx, heading, width / 2, y + 4, p.stunBy === 'boss' ? STAMP : VIOLET);
  lines.forEach((line, i) => drawTextCentered(ctx, line, width / 2, y + 15 + i * 10, INK));
}
