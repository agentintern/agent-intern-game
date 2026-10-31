import { COMBO_SECONDS, ENERGY_MAX, MAX_STRIKES } from '../core/constants';
import { POWER_SECONDS } from '../core/constants';
import { nextGoal, officeClock } from '../core/sim';
import type { World } from '../core/types';
import type { Effects } from './effects';
import { drawText, drawTextCentered, textWidth } from './font';
import { HIGHLIGHT, INK, MINT, PAPER, PAPER_DIM, SKY, STAMP, VIOLET, WHITE } from './palette';
import type { Stick } from './input';
import type { View } from './render';

const BAR_H = 15;

// One line of text under the bar, with a backing so it reads over the office.
function strip(view: View, text: string, color: string): void {
  const w = textWidth(text) + 6;
  view.ctx.fillStyle = INK;
  view.ctx.fillRect(Math.round(view.width / 2 - w / 2), BAR_H, w, 11);
  drawTextCentered(view.ctx, text, view.width / 2, BAR_H + 2, color);
}

export function drawHud(view: View, world: World, label: string, fx: Effects, showGoal: boolean): void {
  const { ctx, width } = view;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, BAR_H);

  const clockColor = world.rush ? STAMP : PAPER;
  drawText(ctx, officeClock(world.time), 4, 4, clockColor);
  drawText(ctx, label, 38, 4, PAPER_DIM);

  const score = String(world.score);
  const scoreX = Math.round(width / 2 - textWidth(score) / 2);
  drawText(ctx, score, scoreX, 4, WHITE);
  if (world.combo > 1) {
    const label = `X${world.combo}`;
    drawText(ctx, label, scoreX + textWidth(score) + 5, 4, HIGHLIGHT);
    ctx.fillStyle = HIGHLIGHT;
    const w = Math.ceil((world.comboT / COMBO_SECONDS) * 14);
    ctx.fillRect(scoreX + textWidth(score) + 5, 12, w, 1);
  }

  // Energy, then one badge per strike left.
  const barW = 34;
  const right = width - 4;
  const strikesLeft = MAX_STRIKES - world.player.strikes;
  for (let i = 0; i < MAX_STRIKES; i++) {
    ctx.fillStyle = i < strikesLeft ? MINT : '#3b3848';
    ctx.fillRect(right - 6 - i * 8, 4, 6, 7);
    ctx.fillStyle = i < strikesLeft ? INK : '#3b3848';
    ctx.fillRect(right - 5 - i * 8, 6, 4, 1);
  }
  const barX = right - 30 - barW;
  ctx.fillStyle = '#3b3848';
  ctx.fillRect(barX, 5, barW, 5);
  const energy = world.player.energy / ENERGY_MAX;
  ctx.fillStyle = energy < 0.25 ? STAMP : world.player.wiredT > 0 ? HIGHLIGHT : SKY;
  ctx.fillRect(barX, 5, Math.ceil(barW * energy), 5);

  ctx.fillStyle = MINT;
  ctx.fillRect(4, BAR_H + 2, Math.ceil((world.player.quietT / POWER_SECONDS) * 30), 2);
  ctx.fillStyle = VIOLET;
  ctx.fillRect(4, BAR_H + 6, Math.ceil((world.player.awayT / POWER_SECONDS) * 30), 2);

  if (world.player.energy <= 0) strip(view, 'NEED COFFEE', STAMP);
  else if (fx.bannerT > 0) strip(view, fx.banner, HIGHLIGHT);
  else if (world.rush) strip(view, "5 O'CLOCK RUSH", Math.floor(world.time * 3) % 2 === 0 ? HIGHLIGHT : STAMP);
  else if (showGoal) strip(view, nextGoal(world.score), PAPER_DIM);
}

export function drawTouchControls(view: View, stick: Stick, scale: number, dash: { x: number; y: number; r: number }, ready: boolean): void {
  const { ctx } = view;
  ctx.globalAlpha = ready ? 0.65 : 0.25;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(dash.x / scale, dash.y / scale, dash.r / scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = ready ? 1 : 0.5;
  ctx.strokeStyle = HIGHLIGHT;
  ctx.lineWidth = 1;
  ctx.stroke();
  drawTextCentered(ctx, 'DASH', dash.x / scale, dash.y / scale - 3, PAPER);
  ctx.globalAlpha = 1;

  if (!stick.active) return;
  const ox = stick.originX / scale;
  const oy = stick.originY / scale;
  const dx = stick.x / scale - ox;
  const dy = stick.y / scale - oy;
  const len = Math.hypot(dx, dy);
  const max = 46 / scale;
  const knobX = ox + (len > max ? (dx / len) * max : dx);
  const knobY = oy + (len > max ? (dy / len) * max : dy);
  ctx.strokeStyle = PAPER;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ox, oy, max, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = PAPER_DIM;
  ctx.beginPath();
  ctx.arc(knobX, knobY, max * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
