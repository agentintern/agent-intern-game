import { performanceReview, type EndingScene } from '../core/sim';
import type { World } from '../core/types';
import { GAME_TASK, GAME_VERSION } from '../version';
import { drawText, drawTextCentered, GLYPH_H, wrapText } from './font';
import type { HallEntry } from './inbox';
import { HIGHLIGHT, INK, MINT, PAPER, PAPER_DIM, STAMP, VIOLET, WHITE } from './palette';
import { WALK, type View } from './render';
import type { Sprite } from './sprites';

const MENU_ROW = 22;
const CARD_H = 181;

export const titleMenuY = (view: View): number => Math.round(view.height / 2) - 11;
const cardY = (view: View): number => Math.max(6, Math.round((view.height - CARD_H - 50) / 2));
export const reviewMenuY = (view: View): number => cardY(view) + CARD_H + 5;

export function menuRowAt(menuY: number, count: number, y: number): number {
  const row = Math.floor((y - menuY) / MENU_ROW);
  return row >= 0 && row < count ? row : -1;
}

function drawMenu(view: View, menuY: number, rows: readonly string[], selected: number): void {
  const { ctx, width } = view;
  rows.forEach((row, i) => {
    const on = i === selected;
    ctx.fillStyle = on ? HIGHLIGHT : INK;
    ctx.fillRect(Math.round(width / 2 - 80), menuY + i * MENU_ROW + 1, 160, MENU_ROW - 3);
    drawTextCentered(ctx, on ? `> ${row} <` : row, width / 2, menuY + i * MENU_ROW + 6, on ? INK : PAPER);
  });
}

// The robot at any size, with its visor lit. `box` is the desk you clear out when fired.
function drawMascot(view: View, frame: Sprite, cx: number, y: number, s: number, glow: number, box = false): void {
  const { ctx } = view;
  const x = Math.round(cx - (frame.width * s) / 2);
  ctx.drawImage(frame, x, y, frame.width * s, frame.height * s);
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#ff9a3d';
  ctx.fillRect(x + 2 * s, y + 3 * s, 8 * s, 3 * s);
  ctx.globalAlpha = 1;
  if (!box) return;
  ctx.fillStyle = '#a4744d';
  ctx.fillRect(x + s, y + 9 * s, 10 * s, 4 * s);
  ctx.fillStyle = '#7d5639';
  ctx.fillRect(x + s, y + 9 * s, 10 * s, s);
}

function veil(view: View, alpha: number): void {
  view.ctx.fillStyle = `rgba(20,17,30,${alpha})`;
  view.ctx.fillRect(0, 0, view.width, view.height);
}

export function drawTitle(view: View, touch: boolean, time: number, rows: readonly string[], selected: number): void {
  const { ctx, width, height } = view;
  veil(view, 0.74);
  const big = width >= 330 ? 3 : 2;
  const menuY = titleMenuY(view);
  const top = Math.max(10, menuY - 150);
  drawTextCentered(ctx, 'LAST DAY', width / 2 + big, top + big, STAMP, big);
  drawTextCentered(ctx, 'LAST DAY', width / 2, top, WHITE, big);
  drawTextCentered(ctx, 'AT THE OFFICE', width / 2 + big, top + 26 + big, STAMP, big);
  drawTextCentered(ctx, 'AT THE OFFICE', width / 2, top + 26, WHITE, big);

  const size = menuY - top - 54 >= 78 ? 5 : 4;
  const robot = view.sprites.internDown[0] as Sprite;
  drawMascot(view, robot, width / 2, menuY - 5 - robot.height * size, size, 0.2 + 0.16 * Math.sin(time * 3));

  drawMenu(view, menuY, rows, selected);
  const tip = touch ? 'TAP A SHIFT TO CLOCK IN' : 'UP AND DOWN TO CHOOSE. SPACE TO CLOCK IN.';
  drawTextCentered(ctx, tip, width / 2, menuY + 70, HIGHLIGHT);
  const controls = touch ? 'DRAG TO MOVE. BUTTON TO DASH.' : 'ARROWS OR WASD. SPACE TO DASH. M MUTE.';
  drawTextCentered(ctx, controls, width / 2, menuY + 82, PAPER_DIM);

  const footer = wrapText(`LAST SHIPPED: ${GAME_TASK}`, Math.floor((width - 12) / 6)).slice(0, 2);
  const footerTop = height - 12 - footer.length * 10;
  drawText(ctx, `V${GAME_VERSION}`, 6, footerTop - 10, MINT);
  footer.forEach((line, i) => drawText(ctx, line, 6, footerTop + i * 10, PAPER_DIM));
}

export function drawHall(view: View, bosses: readonly HallEntry[], time: number): void {
  const { ctx, width, height } = view;
  veil(view, 0.8);
  const x = 12;
  const y = 16;
  const w = width - 24;
  const h = height - 32;
  ctx.fillStyle = '#7f889a';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y, w, h);
  drawTextCentered(ctx, 'HALL OF BOSSES', width / 2, y + 8, VIOLET, width >= 200 ? 2 : 1);
  drawTextCentered(ctx, 'SPACE OR TAP TO GO BACK', width / 2, y + h - 12, VIOLET);

  const chars = Math.floor((w - 16) / 6);
  const empty = 'NOTHING HAS SHIPPED YET. THE BOSS CALLS THIS A CLEAN SLATE.';
  if (bosses.length === 0) wrapText(empty, chars).forEach((line, i) => drawTextCentered(ctx, line, width / 2, y + 44 + i * 11, INK));
  const fit = Math.max(1, Math.floor((h - 46) / 32));
  // A long list scrolls by itself, so it needs no controls on a phone.
  const first = Math.floor(time / 2.5) % Math.max(1, bosses.length - fit + 1);
  bosses.slice(first, first + fit).forEach((entry, i) => {
    const rowY = y + 30 + i * 32;
    wrapText(entry.task, chars).slice(0, 2).forEach((line, n) => drawText(ctx, line.slice(0, chars), x + 8, rowY + n * 9, INK));
    drawText(ctx, `BY ${entry.by}`.slice(0, chars), x + 8, rowY + 18, STAMP);
  });
}

// The short moment before the review card.
export function drawEnding(view: View, world: World, scene: EndingScene, elapsed: number): void {
  const { ctx, width, height } = view;
  const fired = world.endReason === 'fired';
  const y = Math.round(height * 0.26);
  const lines = wrapText(scene.line, Math.floor((width - 16) / 6));
  if (fired) {
    veil(view, 0.55);
    const size = Math.max(3, 9 - Math.floor(elapsed * 40));
    drawTextCentered(ctx, scene.title, width / 2 + 2, y + 2, INK, size);
    drawTextCentered(ctx, scene.title, width / 2, y, STAMP, size);
    drawMascot(view, view.sprites.internDown[0] as Sprite, width / 2, y + 50, 3, 0, true);
  } else {
    veil(view, Math.min(0.72, elapsed * 0.6));
    drawTextCentered(ctx, '17:00', width / 2, y, HIGHLIGHT, 5);
    drawTextCentered(ctx, scene.title, width / 2, y + 42, WHITE, 2);
    const walk = view.sprites.internRight[WALK[Math.floor(elapsed * 9) % 4] as number] as Sprite;
    drawMascot(view, walk, -30 + (width + 60) * (elapsed / scene.seconds), y + 86, 3, 0);
  }
  lines.forEach((line, i) => drawTextCentered(ctx, line, width / 2, y + 62 + (fired ? 62 : 74) + i * 10, PAPER));
}

export function drawPaused(view: View): void {
  veil(view, 0.6);
  drawTextCentered(view.ctx, 'ON BREAK', view.width / 2, view.height / 2 - 12, WHITE, 2);
  drawTextCentered(view.ctx, 'PRESS SPACE OR TAP TO GET BACK TO IT', view.width / 2, view.height / 2 + 10, PAPER_DIM);
}

export function drawReview(view: View, world: World, shift: string, choices: readonly string[], selected: number, elapsed: number): void {
  const { ctx, width, height } = view;
  veil(view, 0.62);
  const review = performanceReview(world);
  const w = Math.min(width - 20, 260);
  const h = CARD_H;
  const x = Math.round((width - w) / 2);
  const y = cardY(view);

  ctx.fillStyle = INK;
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAPER_DIM;
  for (let line = y + 26; line < y + h - 10; line += GLYPH_H + 5) ctx.fillRect(x + 6, line + 9, w - 12, 1);

  drawTextCentered(ctx, 'PERFORMANCE REVIEW', width / 2, y + 8, INK);
  const rows: [string, string][] = [
    ['SHIFT', shift || 'FREE PLAY'],
    ['SCORE', String(world.score)],
    ['TASKS DONE', String(world.stats.tasks)],
    ['TASKS MISSED', String(world.stats.missed)],
    ['COFFEES', String(world.stats.coffees)],
    ['CLOSE CALLS', String(world.stats.nearMisses)],
    ['MEETINGS ATTENDED', String(world.stats.meetings)],
  ];
  rows.forEach(([label, value], i) => {
    const rowY = y + 26 + i * (GLYPH_H + 5);
    drawText(ctx, label, x + 10, rowY, INK);
    drawText(ctx, value, x + w - 10 - value.length * 6, rowY, i === 1 ? STAMP : INK);
  });

  if (elapsed > 0.5) {
    const stampW = review.stamp.length * 6 + 12;
    const stampX = Math.round(width / 2 - stampW / 2);
    const stampY = y + h - 44;
    ctx.fillStyle = PAPER;
    ctx.fillRect(stampX - 1, stampY - 1, stampW + 2, 15);
    ctx.fillStyle = STAMP;
    ctx.fillRect(stampX, stampY, stampW, 1);
    ctx.fillRect(stampX, stampY + 12, stampW, 1);
    ctx.fillRect(stampX, stampY, 1, 13);
    ctx.fillRect(stampX + stampW - 1, stampY, 1, 13);
    drawTextCentered(ctx, review.stamp, width / 2, stampY + 3, STAMP);
    const lines = wrapText(review.line, Math.floor((w - 12) / 6));
    lines.slice(0, 2).forEach((line, i) => drawTextCentered(ctx, line, width / 2, stampY + 18 + i * 9, INK));
    drawMascot(view, view.sprites.internDown[0] as Sprite, x + 21, stampY - 14, 2, 0.25, world.endReason === 'fired');
  }

  if (elapsed > 0.9) drawMenu(view, reviewMenuY(view), choices, selected);
}
