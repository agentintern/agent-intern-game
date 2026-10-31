import { BOSS_SIGHT_HALF_ANGLE, BOSS_SIGHT_RANGE, RUN_SECONDS, TILE } from '../core/constants';
import type { Powerup, Task, World } from '../core/types';
import { COLS, hasLineOfSight, ROWS } from '../levels/office';
import type { Effects } from './effects';
import { drawTextCentered, textWidth, wrapText } from './font';
import { NOTES } from './jokes';
import { INK, MINT, SKY, STAMP, VIOLET, HIGHLIGHT, PAPER } from './palette';
import type { Sprite, SpriteSet } from './sprites';

export interface Camera {
  x: number;
  y: number;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  sprites: SpriteSet;
  map: HTMLCanvasElement;
}

const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
// Step, stand, other step, stand.
export const WALK = [1, 0, 2, 0] as const;
const cam = { x: 0, y: 0 };

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

export function followCamera(view: View, camera: Camera, x: number, y: number, snap = false): void {
  const fit = (target: number, size: number, world: number): number =>
    size >= world ? (world - size) / 2 : Math.max(0, Math.min(world - size, target - size / 2));
  const tx = fit(x, view.width, WORLD_W);
  const ty = fit(y, view.height, WORLD_H);
  const ease = snap ? 1 : 0.12;
  camera.x += (tx - camera.x) * ease;
  camera.y += (ty - camera.y) * ease;
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(16,14,24,0.34)';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
}

function drawTask(ctx: CanvasRenderingContext2D, view: View, task: Task, time: number): void {
  const sprite = view.sprites.tasks[task.kind] as Sprite;
  const bob = Math.sin(time * 5 + task.id) * 1.2;
  const x = Math.round(task.x - sprite.width / 2);
  const y = Math.round(task.y - sprite.height / 2 + bob);
  const expiring = task.life < 3.5 && Math.floor(time * 7) % 2 === 0;

  ctx.fillStyle = task.kind === 'urgent' ? 'rgba(217,64,47,0.28)' : 'rgba(255,216,74,0.22)';
  ctx.beginPath();
  ctx.arc(task.x, task.y, 10, 0, Math.PI * 2);
  ctx.fill();
  shadow(ctx, task.x, task.y + 6, 10);
  if (!expiring) ctx.drawImage(sprite, x, y);

  const lifeW = Math.ceil((task.life / task.maxLife) * 14);
  ctx.fillStyle = INK;
  ctx.fillRect(Math.round(task.x - 8), Math.round(task.y - 12), 16, 3);
  ctx.fillStyle = task.life < 3.5 ? STAMP : MINT;
  ctx.fillRect(Math.round(task.x - 7), Math.round(task.y - 11), lifeW, 1);

  if (task.work > 0) {
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(task.x, task.y, 11, -Math.PI / 2, -Math.PI / 2 + (task.work / task.need) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPowerup(ctx: CanvasRenderingContext2D, view: View, item: Powerup, time: number): void {
  const sprite = view.sprites.tasks[item.kind] as Sprite;
  ctx.fillStyle = 'rgba(95,211,163,0.3)';
  ctx.beginPath();
  ctx.arc(item.x, item.y, 10 + Math.sin(time * 6), 0, Math.PI * 2);
  ctx.fill();
  if (item.life < 3 && Math.floor(time * 7) % 2 === 0) return;
  ctx.drawImage(sprite, Math.round(item.x - 5), Math.round(item.y - 4 + Math.sin(time * 4)));
}

function drawBossCone(ctx: CanvasRenderingContext2D, world: World): void {
  const { boss, office } = world;
  if (boss.state === 'waiting' || boss.state === 'cooldown') return;
  const hunting = boss.state === 'chase' || boss.state === 'alert';
  ctx.fillStyle = hunting ? 'rgba(217,64,47,0.26)' : 'rgba(255,216,74,0.17)';
  ctx.beginPath();
  ctx.moveTo(boss.x, boss.y);
  const rays = 16;
  for (let i = 0; i <= rays; i++) {
    const angle = boss.angle - BOSS_SIGHT_HALF_ANGLE + (i / rays) * BOSS_SIGHT_HALF_ANGLE * 2;
    let reach = BOSS_SIGHT_RANGE;
    const ex = boss.x + Math.cos(angle) * reach;
    const ey = boss.y + Math.sin(angle) * reach;
    if (!hasLineOfSight(office, boss.x, boss.y, ex, ey)) {
      let lo = 0;
      let hi = reach;
      for (let k = 0; k < 5; k++) {
        const mid = (lo + hi) / 2;
        if (hasLineOfSight(office, boss.x, boss.y, boss.x + Math.cos(angle) * mid, boss.y + Math.sin(angle) * mid)) lo = mid;
        else hi = mid;
      }
      reach = lo;
    }
    ctx.lineTo(boss.x + Math.cos(angle) * reach, boss.y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fill();
}

function internFrame(view: View, world: World): Sprite {
  const { player: p } = world;
  const set =
    p.facing === 'up' ? view.sprites.internUp
    : p.facing === 'left' ? view.sprites.internLeft
    : p.facing === 'right' ? view.sprites.internRight
    : view.sprites.internDown;
  return set[p.moving ? (WALK[Math.floor(p.walkT * 11) % 4] as number) : 0] as Sprite;
}

function drawPlayer(ctx: CanvasRenderingContext2D, view: View, world: World): void {
  const { player: p, time } = world;
  const sprite = internFrame(view, world);
  const blinking = p.iframes > 0 && Math.floor(time * 16) % 2 === 0;
  shadow(ctx, p.x, p.y + 5, 10);
  if (blinking) return;

  if (p.dashT > 0) {
    ctx.globalAlpha = 0.4;
    ctx.drawImage(sprite, Math.round(p.x - 6 - p.dashX * 9), Math.round(p.y - 8 - p.dashY * 9));
    ctx.globalAlpha = 0.2;
    ctx.drawImage(sprite, Math.round(p.x - 6 - p.dashX * 16), Math.round(p.y - 8 - p.dashY * 16));
  }
  ctx.globalAlpha = p.awayT > 0 ? 0.5 : 1;
  ctx.drawImage(sprite, Math.round(p.x - 6), Math.round(p.y - 8));
  ctx.globalAlpha = 1;

  if (p.quietT > 0) {
    ctx.fillStyle = MINT;
    ctx.fillRect(Math.round(p.x - 6), Math.round(p.y - 8), 12, 1);
    ctx.fillRect(Math.round(p.x - 7), Math.round(p.y - 5), 2, 4);
    ctx.fillRect(Math.round(p.x + 5), Math.round(p.y - 5), 2, 4);
  }

  if (p.wiredT > 0 && Math.floor(time * 12) % 2 === 0) {
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(Math.round(p.x - 8), Math.round(p.y - 10), 1, 2);
    ctx.fillRect(Math.round(p.x + 7), Math.round(p.y - 7), 1, 2);
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, view: View, world: World): void {
  const { boss, time } = world;
  const moving = boss.state === 'patrol' || boss.state === 'chase';
  const frame = moving ? 1 + (Math.floor(boss.walkT * 7) % 2) : 0;
  shadow(ctx, boss.x, boss.y + 6, 12);
  ctx.drawImage(view.sprites.boss[frame] as Sprite, Math.round(boss.x - 7), Math.round(boss.y - 10));
  if (boss.state === 'alert' || boss.state === 'chase') {
    const pulse = Math.floor(time * 10) % 2;
    ctx.fillStyle = STAMP;
    ctx.fillRect(Math.round(boss.x - 1), Math.round(boss.y - 21 - pulse), 3, 6);
    ctx.fillRect(Math.round(boss.x - 1), Math.round(boss.y - 14 - pulse), 3, 2);
  }
}

// Off-screen work gets a small arrow on the edge of the screen, or a narrow phone would hide it.
function drawArrow(ctx: CanvasRenderingContext2D, view: View, camera: Camera, x: number, y: number, color: string): void {
  const sx = x - camera.x;
  const sy = y - camera.y;
  if (sx > 6 && sy > 22 && sx < view.width - 6 && sy < view.height - 6) return;
  const cx = view.width / 2;
  const cy = view.height / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const reach = Math.min((view.width / 2 - 9) / Math.abs(dx || 1), (view.height / 2 - 18) / Math.abs(dy || 1));
  const ax = cx + dx * reach;
  const ay = cy + dy * reach + 7;
  const angle = Math.atan2(dy, dx);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(ax, ay, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(angle) * 5, ay + Math.sin(angle) * 5);
  ctx.lineTo(ax + Math.cos(angle + 2.4) * 4, ay + Math.sin(angle + 2.4) * 4);
  ctx.lineTo(ax + Math.cos(angle - 2.4) * 4, ay + Math.sin(angle - 2.4) * 4);
  ctx.closePath();
  ctx.fill();
}

function drawArrows(view: View, camera: Camera, world: World): void {
  const { ctx } = view;
  const p = world.player;
  const first = nearest(world.tasks, p.x, p.y);
  const second = nearest(world.tasks, p.x, p.y, first);
  if (first) drawArrow(ctx, view, camera, first.x, first.y, first.kind === 'urgent' ? STAMP : HIGHLIGHT);
  if (second) drawArrow(ctx, view, camera, second.x, second.y, second.kind === 'urgent' ? STAMP : HIGHLIGHT);
  const item = world.powerups[0];
  if (item) drawArrow(ctx, view, camera, item.x, item.y, MINT);
  const cup = p.energy < 40 ? nearest(world.coffees, p.x, p.y) : null;
  if (cup) drawArrow(ctx, view, camera, cup.x, cup.y, SKY);
  if (world.boss.state === 'chase') drawArrow(ctx, view, camera, world.boss.x, world.boss.y, STAMP);
}

// The day passes: a clear morning turns to a low orange sun, then to dusk.
function drawDaylight(view: View, world: World): void {
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

// Stacked red bands at the edges. Plain rectangles, so a chase costs next to nothing to draw.
function drawChaseVignette(view: View, world: World): void {
  const { ctx, width, height } = view;
  const { state } = world.boss;
  if (state !== 'chase' && state !== 'alert') return;
  ctx.fillStyle = STAMP;
  ctx.globalAlpha = 0.11 + 0.06 * Math.sin(world.time * 9);
  for (let band = 1; band <= 4; band++) {
    const size = band * 7;
    ctx.fillRect(0, 0, width, size);
    ctx.fillRect(0, height - size, width, size);
    ctx.fillRect(0, size, size, height - size * 2);
    ctx.fillRect(width - size, size, size, height - size * 2);
  }
  ctx.globalAlpha = 1;
}

// A sticky note reads itself out when you walk past it.
function drawNearbyNote(view: View, world: World): void {
  const { ctx, width } = view;
  const p = world.player;
  for (const note of NOTES) {
    const x = note.tx * TILE + 8;
    const y = note.ty * TILE;
    if (Math.abs(x - p.x) > 28 || Math.abs(y - p.y) > 28) continue;
    const half = textWidth(note.text) / 2;
    const sx = Math.round(Math.max(half + 4, Math.min(width - half - 4, x - cam.x)));
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(sx - half - 3, y - cam.y - 13, half * 2 + 6, 11);
    drawTextCentered(ctx, note.text, sx, y - cam.y - 11, INK);
    return;
  }
}

function drawStunCard(view: View, world: World): void {
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

function drawMeetings(ctx: CanvasRenderingContext2D, view: View, world: World, from: number, to: number): void {
  for (const m of world.meetings) {
    if (m.y < from || m.y >= to) continue;
    const frame = Math.floor(world.time * 5 + m.id) % 2;
    shadow(ctx, m.x, m.y + 5, 10);
    ctx.drawImage(view.sprites.meeting[frame] as Sprite, Math.round(m.x - 6), Math.round(m.y - 6));
  }
}

export function renderWorld(view: View, camera: Camera, world: World, fx: Effects, live: boolean): void {
  const { ctx, width, height } = view;
  const shakeX = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 7 : 0;
  const shakeY = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 7 : 0;
  cam.x = Math.round(camera.x + shakeX);
  cam.y = Math.round(camera.y + shakeY);

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(view.map, 0, 0);

  for (const cup of world.coffees) {
    const bob = Math.round(Math.sin(world.time * 4 + cup.id));
    shadow(ctx, cup.x, cup.y + 6, 8);
    ctx.drawImage(view.sprites.cup, Math.round(cup.x - 5), Math.round(cup.y - 5 + bob));
  }
  for (const task of world.tasks) drawTask(ctx, view, task, world.time);
  for (const item of world.powerups) drawPowerup(ctx, view, item, world.time);
  drawBossCone(ctx, world);

  // Sorted by y with no list to build: meetings behind, then the two people, then meetings in front.
  const playerFirst = world.player.y < world.boss.y;
  const low = Math.min(world.player.y, world.boss.y);
  const high = Math.max(world.player.y, world.boss.y);
  drawMeetings(ctx, view, world, -Infinity, low);
  if (playerFirst) drawPlayer(ctx, view, world);
  else drawBoss(ctx, view, world);
  drawMeetings(ctx, view, world, low, high);
  if (playerFirst) drawBoss(ctx, view, world);
  else drawPlayer(ctx, view, world);
  drawMeetings(ctx, view, world, high, Infinity);

  for (const p of fx.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.restore();

  drawDaylight(view, world);

  for (const popup of fx.popups) {
    drawTextCentered(ctx, popup.text, popup.x - cam.x + 1, popup.y - cam.y + 1, INK);
    drawTextCentered(ctx, popup.text, popup.x - cam.x, popup.y - cam.y, popup.color);
  }

  if (live) {
    drawChaseVignette(view, world);
    drawNearbyNote(view, world);
    drawArrows(view, camera, world);
    drawStunCard(view, world);
  }

  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}


