import { TILE } from '../core/constants';
import { charAt, COLS, ROWS, type Office } from '../levels/office';
import { night, shade } from './box';

export type Room = 'open' | 'boss' | 'meeting' | 'break' | 'print';

export function roomAt(tx: number, ty: number): Room {
  if (ty <= 7 && tx <= 7) return 'meeting';
  if (ty <= 7 && tx >= 33) return 'boss';
  if (ty >= 19 && tx <= 12) return 'break';
  if (ty >= 19 && tx >= 27) return 'print';
  return 'open';
}

const CARPET: Partial<Record<Room, string>> = { open: '#5a6c8c', boss: '#7a3346', meeting: '#3f7471' };
const HARD: Partial<Record<Room, string>> = { break: '#c7a884', print: '#a9adb5' };

export const speck = (a: number, b: number, c = 0): number => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

export function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return [canvas, ctx];
}

// Fine grain laid over every material, so nothing reads as a flat fill.
function grain(size: number, strength: number): HTMLCanvasElement {
  const [canvas, ctx] = canvasOf(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = speck(x, y, 3);
      ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * strength})` : `rgba(0,0,0,${(0.5 - v) * strength})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// Carpet squares are two map tiles wide and laid with the pile turned, so the floor doesn't read as the game's grid.
function carpetTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, color: string, s: number): void {
  const x = tx * s;
  const y = ty * s;
  const cx = Math.floor(tx / 2);
  const cy = Math.floor(ty / 2);
  ctx.fillStyle = shade(night(color), 0.97 + speck(cx, cy, 1) * 0.06);
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.016)';
  const across = (cx + cy) % 2 === 0;
  for (let i = 1; i < s; i += 3) {
    if (across) ctx.fillRect(x, y + i, s, 1);
    else ctx.fillRect(x + i, y, 1, s);
  }
  ctx.fillStyle = 'rgba(8,8,16,0.13)';
  if (ty % 2 === 0) ctx.fillRect(x, y, s, 1);
  if (tx % 2 === 0) ctx.fillRect(x, y, 1, s);
}

function hardTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, color: string, s: number): void {
  const x = tx * s;
  const y = ty * s;
  ctx.fillStyle = shade(night(color), 0.96 + speck(Math.floor(tx / 2), Math.floor(ty / 2), 2) * 0.07);
  ctx.fillRect(x, y, s, s);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = speck(tx, ty, i) > 0.5 ? 'rgba(255,245,225,0.12)' : 'rgba(20,16,28,0.16)';
    ctx.fillRect(x + speck(tx, ty, i + 20) * s, y + speck(tx, ty, i + 40) * s, 1 + speck(i, tx, 1) * 2, 1 + speck(i, ty, 2) * 2);
  }
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  if (ty % 2 === 0) ctx.fillRect(x, y, s, 1);
  if (tx % 2 === 0) ctx.fillRect(x, y, 1, s);
}

// The whole floor, painted looking straight down. The scene lays it over in one piece, so there are no tile seams.
export const FLOOR_SCALE = 3;

export function paintFloor(shadows: HTMLCanvasElement, light: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const s = TILE * FLOOR_SCALE;
  const [canvas, ctx] = canvasOf(COLS * s, ROWS * s);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const room = roomAt(tx, ty);
      const hard = HARD[room];
      if (hard) hardTile(ctx, tx, ty, hard, s);
      else carpetTile(ctx, tx, ty, CARPET[room] as string, s);
    }
  }
  const pattern = ctx.createPattern(grain(128, 0.09), 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Rugs in the two rooms that would have one.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(1.6 * s, 1.5 * s, 5 * s, 3.9 * s);
  ctx.strokeStyle = 'rgba(220,190,120,0.34)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1.75 * s, 1.65 * s, 4.7 * s, 3.6 * s);
  ctx.fillRect(35.1 * s, 1.5 * s, 3.6 * s, 3.6 * s);
  ctx.strokeRect(35.25 * s, 1.65 * s, 3.3 * s, 3.3 * s);

  // Lights first and shadows after, so a lamp can't turn a shadow red.
  ctx.save();
  ctx.scale(FLOOR_SCALE, FLOOR_SCALE);
  ctx.globalCompositeOperation = 'color-dodge';
  light(ctx);
  ctx.restore();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(shadows, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

// Soft contact shadows: solid shapes, shrunk and stretched back, which blurs them on any browser.
export function softShadows(office: Office, footOf: (c: string, tx: number, ty: number) => number): HTMLCanvasElement {
  const [wide, ctx] = canvasOf(COLS * TILE, ROWS * TILE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, wide.width, wide.height);
  ctx.fillStyle = '#23202e';
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const foot = footOf(charAt(office.tiles, tx, ty), tx, ty);
      if (foot > 0) ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE * foot + 2, TILE * foot + 2);
    }
  }
  const pass = (from: HTMLCanvasElement, size: number): HTMLCanvasElement => {
    const [small, sctx] = canvasOf(from.width / size, from.height / size);
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(from, 0, 0, small.width, small.height);
    return small;
  };
  const soft = pass(pass(wide, 2), 2);
  const [done, dctx] = canvasOf(wide.width, wide.height);
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(soft, 0, 0, done.width, done.height);
  dctx.globalAlpha = 0.6;
  dctx.drawImage(pass(soft, 2), 0, 0, done.width, done.height);
  return done;
}

// The city through a window: dark blocks, lit rooms and rain on the glass. (u, v) run along and up the wall.
export function cityView(ctx: CanvasRenderingContext2D, u: number, w: number, wallHeight: number, seed: number): void {
  const low = 12;
  const high = wallHeight - 8;
  const sky = ctx.createLinearGradient(0, -high, 0, -low);
  sky.addColorStop(0, '#0e1630');
  sky.addColorStop(0.7, '#1b2a54');
  sky.addColorStop(1, '#3a3a6a');
  ctx.fillStyle = sky;
  ctx.fillRect(u, -high, w, high - low);
  for (let i = 0; i < 9; i++) {
    const bw = 5 + speck(seed, i, 1) * 9;
    const bx = u + (i / 9) * w - 2;
    const bh = 10 + speck(seed, i, 2) * 26;
    ctx.fillStyle = shade('#121a34', 0.8 + speck(seed, i, 3) * 0.5);
    ctx.fillRect(bx, -(low + bh), Math.min(bw, u + w - bx), bh);
    for (let n = 0; n < 12; n++) {
      const wx = bx + 1 + speck(seed, i, n + 4) * (bw - 2);
      if (wx > u + w - 1) continue;
      ctx.fillStyle = speck(seed, n, i) > 0.45 ? 'rgba(255,196,110,0.9)' : 'rgba(150,190,255,0.7)';
      ctx.fillRect(wx, -(low + speck(i, n, seed) * bh), 0.8, 1);
    }
  }
  ctx.fillStyle = 'rgba(170,200,240,0.13)';
  for (let i = 0; i < w * 0.9; i++) {
    const rx = u + speck(seed, i, 8) * w;
    const ry = low + speck(i, seed, 9) * (high - low - 8);
    ctx.fillRect(rx, -(ry + 7), 0.3, 3 + speck(i, seed, 7) * 5);
  }
  ctx.strokeStyle = night('#c6ccd6');
  ctx.lineWidth = 1;
  ctx.strokeRect(u, -high, w, high - low);
  ctx.fillStyle = night('#c6ccd6');
  for (let i = 1; i < w / TILE; i++) ctx.fillRect(u + (i * w) / Math.round(w / TILE) - 0.4, -high, 0.8, high - low);
  ctx.fillRect(u, -(low + (high - low) * 0.62), w, 0.6);
  ctx.fillStyle = shade(night('#e8dcc2'), 1.1);
  ctx.fillRect(u - 1, -low, w + 2, 1.4);
}
