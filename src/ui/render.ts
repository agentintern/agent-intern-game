import { BOSS_SIGHT_HALF_ANGLE, BOSS_SIGHT_RANGE, RUN_SECONDS, TILE } from '../core/constants';
import type { Task, World } from '../core/types';
import { COLS, hasLineOfSight, ROWS } from '../levels/office';
import type { Effects } from './effects';
import { drawTextCentered, wrapText } from './font';
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
  const frame = p.moving ? 1 + (Math.floor(p.walkT * 9) % 2) : 0;
  return set[frame] as Sprite;
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
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(sprite, Math.round(p.x - 6), Math.round(p.y - 8));

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
  const byDistance = [...world.tasks].sort(
    (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
  );
  for (const task of byDistance.slice(0, 2)) {
    drawArrow(ctx, view, camera, task.x, task.y, task.kind === 'urgent' ? STAMP : HIGHLIGHT);
  }
  if (p.energy < 40) {
    const cup = [...world.coffees].sort(
      (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
    if (cup) drawArrow(ctx, view, camera, cup.x, cup.y, SKY);
  }
  if (world.boss.state === 'chase') drawArrow(ctx, view, camera, world.boss.x, world.boss.y, STAMP);
}

// The day passes: a clear morning turns to a low orange sun, then to dusk.
function drawDaylight(view: View, world: World): void {
  const t = Math.min(1, world.time / RUN_SECONDS);
  const { ctx, width, height } = view;
  if (t < 0.45) return;
  const dusk = (t - 0.45) / 0.55;
  ctx.fillStyle = `rgba(214,104,58,${(dusk * 0.22).toFixed(3)})`;
  ctx.fillRect(0, 0, width, height);
  if (dusk > 0.7) {
    ctx.fillStyle = `rgba(36,24,74,${(((dusk - 0.7) / 0.3) * 0.26).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
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

export function renderWorld(view: View, camera: Camera, world: World, fx: Effects, live: boolean): void {
  const { ctx, width, height } = view;
  const shakeX = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 7 : 0;
  const shakeY = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 7 : 0;
  const cam = { x: Math.round(camera.x + shakeX), y: Math.round(camera.y + shakeY) };

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
  drawBossCone(ctx, world);

  const actors = [
    ...world.meetings.map((m) => ({ y: m.y, draw: () => {
      const frame = Math.floor(world.time * 5 + m.id) % 2;
      shadow(ctx, m.x, m.y + 5, 10);
      ctx.drawImage(view.sprites.meeting[frame] as Sprite, Math.round(m.x - 6), Math.round(m.y - 6));
    } })),
    { y: world.player.y, draw: () => drawPlayer(ctx, view, world) },
    { y: world.boss.y, draw: () => drawBoss(ctx, view, world) },
  ].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw();

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


