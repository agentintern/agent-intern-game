import { TILE } from '../core/constants';
import type { World } from '../core/types';
import type { Effects } from './effects';
import { drawTextCentered, textWidth } from './font';
import type { Spot } from './iso';
import { itemArt } from './items';
import { NOTES } from './jokes';
import { HIGHLIGHT, INK, MINT, PAPER, SKY, STAMP, VIOLET } from './palette';
import { drawDaylight, drawStunCard, nearest } from './render';
import { paintWorld, toHud, type Camera, type View } from './stage';

// Everything drawn over the world, in HUD pixels: tags, markers, notes and popups.
const hunting = (world: World): boolean => world.boss.state === 'chase' || world.boss.state === 'alert';

// Red at the edges of the screen. Four strips, so a chase costs next to nothing to draw.
function drawChaseVignette(view: View, world: World): void {
  const { ctx, width, height } = view;
  if (!hunting(world)) return;
  const edge = Math.min(width, height) * 0.2;
  const strip = (x: number, y: number, w: number, h: number, x0: number, y0: number, x1: number, y1: number): void => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(217,64,47,0.55)');
    g.addColorStop(1, 'rgba(217,64,47,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };
  ctx.globalAlpha = 0.72 + 0.28 * Math.sin(world.time * 9);
  strip(0, 0, width, edge, 0, 0, 0, edge);
  strip(0, height - edge, width, edge, 0, height, 0, height - edge);
  strip(0, 0, edge, height, 0, 0, edge, 0);
  strip(width - edge, 0, edge, height, width, 0, width - edge, 0);
  ctx.globalAlpha = 1;
}

function drawTag(view: View, text: string, x: number, y: number, color: string): void {
  const { ctx, width } = view;
  const half = Math.ceil(textWidth(text) / 2) + 3;
  const sx = Math.round(Math.max(half + 2, Math.min(width - half - 2, x)));
  const sy = Math.round(y);
  ctx.fillStyle = INK;
  ctx.fillRect(sx - half, sy - 1, half * 2, 10);
  ctx.fillStyle = color;
  ctx.fillRect(sx - half, sy + 8, half * 2, 1);
  drawTextCentered(ctx, text, sx, sy + 0.5, PAPER);
}

function drawNameTags(view: View, camera: Spot, world: World): void {
  const p = world.player;
  const { boss } = world;
  const b = toHud(view, camera, boss.x, boss.y, 40);
  if (b.x > 0 && b.y > 0 && b.x < view.width && b.y < view.height) drawTag(view, 'BOSS', b.x, b.y - 11, hunting(world) ? STAMP : VIOLET);
  const task = nearest(world.tasks, p.x, p.y);
  if (task && Math.hypot(task.x - p.x, task.y - p.y) < 60) {
    const at = toHud(view, camera, task.x, task.y, 34);
    drawTag(view, itemArt(task.kind).tag, at.x, at.y - 11, task.kind === 'urgent' ? STAMP : HIGHLIGHT);
  }
}

const MARKER_GAP = 19;

// Markers that land together stack toward the middle of the edge, so each stays readable. There are at most six,
// so the walk is bounded and always goes one way.
export function stackMarker(placed: readonly Spot[], x: number, y: number, middle: number): number {
  const step = y > middle ? -MARKER_GAP : MARKER_GAP;
  let at = y;
  for (let i = 0; i < 7 && placed.some((m) => Math.hypot(m.x - x, m.y - at) < MARKER_GAP); i++) at += step;
  return at;
}

// Off-screen work and the boss get a marker on the edge of the screen, or a narrow phone would hide them.
function drawMarker(view: View, camera: Spot, placed: Spot[], x: number, y: number, color: string, letter: string): void {
  const { ctx, width, height } = view;
  const at = toHud(view, camera, x, y, 8);
  if (at.x > 6 && at.y > 22 && at.x < width - 6 && at.y < height - 6) return;
  const cx = width / 2;
  const cy = height / 2 + 8;
  const dx = at.x - cx;
  const dy = at.y - cy;
  const reach = Math.min((width / 2 - 10) / Math.abs(dx || 1), (height / 2 - 26) / Math.abs(dy || 1));
  const ax = Math.round(cx + dx * reach);
  const ay = stackMarker(placed, ax, Math.round(cy + dy * reach), cy);
  placed.push({ x: ax, y: ay });
  const angle = Math.atan2(dy, dx);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(ax, ay, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(angle) * 11, ay + Math.sin(angle) * 11);
  ctx.lineTo(ax + Math.cos(angle + 2.3) * 7, ay + Math.sin(angle + 2.3) * 7);
  ctx.lineTo(ax + Math.cos(angle - 2.3) * 7, ay + Math.sin(angle - 2.3) * 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(ax, ay, 6, 0, Math.PI * 2);
  ctx.fill();
  drawTextCentered(ctx, letter, ax, ay - 3, color);
}

function drawMarkers(view: View, camera: Spot, world: World): void {
  const p = world.player;
  const placed: Spot[] = [];
  const mark = (thing: { x: number; y: number } | null | undefined, color: string, letter: string): void => {
    if (thing) drawMarker(view, camera, placed, thing.x, thing.y, color, letter);
  };
  if (world.boss.state !== 'waiting') mark(world.boss, STAMP, 'B');
  const first = nearest(world.tasks, p.x, p.y);
  const second = nearest(world.tasks, p.x, p.y, first);
  mark(first, first?.kind === 'urgent' ? STAMP : HIGHLIGHT, '!');
  mark(second, second?.kind === 'urgent' ? STAMP : HIGHLIGHT, '!');
  mark(world.powerups[0], MINT, '+');
  mark(p.energy < 40 ? nearest(world.coffees, p.x, p.y) : null, SKY, 'C');
}

// A sticky note reads itself out when you walk past it.
function drawNearbyNote(view: View, camera: Spot, world: World): void {
  const p = world.player;
  for (const note of NOTES) {
    const x = note.tx * TILE + 8;
    const y = note.ty * TILE + 8;
    if (Math.abs(x - p.x) > 28 || Math.abs(y - p.y) > 28) continue;
    const at = toHud(view, camera, x, y, 22);
    drawTag(view, note.text, at.x, at.y - 10, HIGHLIGHT);
    return;
  }
}

export function renderWorld(view: View, camera: Camera, world: World, fx: Effects, live: boolean, teaching = false): void {
  const { ctx } = view;
  const snapped = paintWorld(view, camera, world, fx);
  if (!snapped) return;
  ctx.setTransform(view.unit, 0, 0, view.unit, 0, 0);
  drawDaylight(view, world);
  for (const popup of fx.popups) {
    // The sim's popups drift up in world y, so that's undone here, and they rise up the screen instead.
    const rise = (0.95 - popup.life) * 22;
    const at = toHud(view, snapped, popup.x, popup.y + rise, 24 + rise);
    drawTextCentered(ctx, popup.text, at.x + 1, at.y + 1, INK);
    drawTextCentered(ctx, popup.text, at.x, at.y, popup.color);
  }
  if (live) {
    drawChaseVignette(view, world);
    if (!teaching) drawNameTags(view, snapped, world);
    drawNearbyNote(view, snapped, world);
    drawMarkers(view, snapped, world);
    drawStunCard(view, world);
  }
  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalAlpha = 1;
  }
}
