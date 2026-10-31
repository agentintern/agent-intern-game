import { performanceReview } from '../core/sim';
import type { World } from '../core/types';
import { GAME_TASK, GAME_VERSION } from '../version';
import { drawText, drawTextCentered, GLYPH_H, wrapText } from './font';
import { HIGHLIGHT, INK, MINT, PAPER, PAPER_DIM, STAMP, WHITE } from './palette';
import type { View } from './render';

function veil(view: View, alpha: number): void {
  view.ctx.fillStyle = `rgba(20,17,30,${alpha})`;
  view.ctx.fillRect(0, 0, view.width, view.height);
}

export function drawTitle(view: View, touch: boolean, time: number): void {
  const { ctx, width, height } = view;
  veil(view, 0.74);
  const big = width >= 330 ? 3 : 2;
  const top = Math.max(26, Math.round(height / 2 - 92));
  drawTextCentered(ctx, 'LAST DAY', width / 2 + big, top + big, STAMP, big);
  drawTextCentered(ctx, 'LAST DAY', width / 2, top, WHITE, big);
  drawTextCentered(ctx, 'AT THE OFFICE', width / 2 + big, top + 26 + big, STAMP, big);
  drawTextCentered(ctx, 'AT THE OFFICE', width / 2, top + 26, WHITE, big);

  const lines = [
    'FINISH TASKS. DRINK COFFEE.',
    'DODGE MEETINGS. AVOID THE BOSS.',
    'CLOCK OUT AT 17:00.',
  ];
  lines.forEach((line, i) => drawTextCentered(ctx, line, width / 2, top + 58 + i * 11, PAPER_DIM));

  if (Math.floor(time * 2) % 2 === 0) {
    drawTextCentered(ctx, touch ? 'TAP TO CLOCK IN' : 'PRESS SPACE TO CLOCK IN', width / 2, top + 104, HIGHLIGHT);
  }
  const controls = touch ? 'DRAG TO MOVE. BUTTON TO DASH.' : 'ARROWS OR WASD. SPACE TO DASH. M MUTE.';
  drawTextCentered(ctx, controls, width / 2, top + 120, PAPER_DIM);

  const footer = wrapText(`LAST SHIPPED: ${GAME_TASK}`, Math.floor((width - 12) / 6)).slice(0, 2);
  const footerTop = height - 12 - footer.length * 10;
  drawText(ctx, `V${GAME_VERSION}`, 6, footerTop - 10, MINT);
  footer.forEach((line, i) => drawText(ctx, line, 6, footerTop + i * 10, PAPER_DIM));
}

export function drawPaused(view: View): void {
  veil(view, 0.6);
  drawTextCentered(view.ctx, 'ON BREAK', view.width / 2, view.height / 2 - 12, WHITE, 2);
  drawTextCentered(view.ctx, 'PRESS SPACE OR TAP TO GET BACK TO IT', view.width / 2, view.height / 2 + 10, PAPER_DIM);
}

export function drawReview(view: View, world: World, touch: boolean, elapsed: number): void {
  const { ctx, width, height } = view;
  veil(view, 0.62);
  const review = performanceReview(world);
  const w = Math.min(width - 20, 260);
  const h = 168;
  const x = Math.round((width - w) / 2);
  const y = Math.max(20, Math.round((height - h) / 2));

  ctx.fillStyle = INK;
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAPER_DIM;
  for (let line = y + 26; line < y + h - 10; line += GLYPH_H + 5) ctx.fillRect(x + 6, line + 9, w - 12, 1);

  drawTextCentered(ctx, 'PERFORMANCE REVIEW', width / 2, y + 8, INK);
  const rows: [string, string][] = [
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
    drawText(ctx, value, x + w - 10 - value.length * 6, rowY, i === 0 ? STAMP : INK);
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
  }

  if (elapsed > 0.9 && Math.floor(elapsed * 2) % 2 === 0) {
    drawTextCentered(ctx, touch ? 'TAP FOR ANOTHER DAY' : 'SPACE FOR ANOTHER DAY', width / 2, y + h + 12, HIGHLIGHT);
  }
}
