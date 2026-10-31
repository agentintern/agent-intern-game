import { TILE } from '../core/constants';
import { charAt, COLS, ROWS, type Office } from '../levels/office';
import { COFFEE, INK, MINT, PAPER, PAPER_DIM, SKY, STAMP, VIOLET, WHITE } from './palette';

const CARPET_A = '#5b6577';
const CARPET_B = '#566072';
const CARPET_SPECK = '#6a7487';
const TILE_A = '#c9c0ae';
const TILE_B = '#bdb4a1';
const WALL_TOP = '#2c2a3a';
const WALL_FACE = '#d9cfb8';
const WALL_SHADE = '#b7ac94';
const WOOD = '#a4744d';
const WOOD_DARK = '#7d5639';

function speck(tx: number, ty: number, i: number): number {
  const v = Math.sin(tx * 127.1 + ty * 311.7 + i * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function floor(ctx: CanvasRenderingContext2D, tx: number, ty: number, hard: boolean): void {
  const x = tx * TILE;
  const y = ty * TILE;
  if (hard) {
    ctx.fillStyle = (tx + ty) % 2 === 0 ? TILE_A : TILE_B;
    ctx.fillRect(x, y, TILE, TILE);
    return;
  }
  ctx.fillStyle = (tx + ty) % 2 === 0 ? CARPET_A : CARPET_B;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = CARPET_SPECK;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + Math.floor(speck(tx, ty, i) * 15), y + Math.floor(speck(tx, ty, i + 9) * 15), 1, 1);
  }
}

function wall(ctx: CanvasRenderingContext2D, office: Office, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const below = charAt(office.tiles, tx, ty + 1);
  const seesRoom = below !== '#' && below !== 'w' && ty < ROWS - 1;
  ctx.fillStyle = WALL_TOP;
  ctx.fillRect(x, y, TILE, TILE);
  if (seesRoom) {
    ctx.fillStyle = WALL_FACE;
    ctx.fillRect(x, y + 5, TILE, 11);
    ctx.fillStyle = WALL_SHADE;
    ctx.fillRect(x, y + 14, TILE, 2);
    if (ty === 0 && tx % 4 === 1) {
      ctx.fillStyle = INK;
      ctx.fillRect(x + 1, y + 6, TILE - 2, 7);
      ctx.fillStyle = SKY;
      ctx.fillRect(x + 2, y + 7, TILE - 4, 5);
      ctx.fillStyle = WHITE;
      ctx.fillRect(x + 4, y + 8, 3, 1);
    }
  }
}

function desk(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = WOOD;
  ctx.fillRect(x, y + 3, TILE, 11);
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x, y + 12, TILE, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(x + 3, y + 1, 10, 7);
  ctx.fillStyle = (tx + ty) % 3 === 0 ? MINT : SKY;
  ctx.fillRect(x + 4, y + 2, 8, 5);
  ctx.fillStyle = INK;
  ctx.fillRect(x + 7, y + 8, 2, 2);
  ctx.fillStyle = PAPER_DIM;
  ctx.fillRect(x + 4, y + 10, 8, 2);
}

function plant(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#2f7a55';
  ctx.fillRect(x + 3, y + 1, 10, 9);
  ctx.fillStyle = '#44a374';
  ctx.fillRect(x + 5, y, 3, 7);
  ctx.fillRect(x + 9, y + 2, 3, 6);
  ctx.fillStyle = '#c1633d';
  ctx.fillRect(x + 4, y + 10, 8, 5);
  ctx.fillStyle = '#8f4528';
  ctx.fillRect(x + 4, y + 14, 8, 1);
}

function partition(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#9aa3b5';
  ctx.fillRect(x + 1, y, 14, TILE);
  ctx.fillStyle = '#7f889a';
  ctx.fillRect(x + 1, y + 13, 14, 3);
  ctx.fillStyle = '#b5bccb';
  ctx.fillRect(x + 1, y, 14, 2);
}

function cabinet(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#8c94a3';
  ctx.fillRect(x + 2, y, 12, 15);
  ctx.fillStyle = '#6c7482';
  ctx.fillRect(x + 2, y + 4, 12, 1);
  ctx.fillRect(x + 2, y + 9, 12, 1);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 6, y + 2, 4, 1);
  ctx.fillRect(x + 6, y + 7, 4, 1);
  ctx.fillRect(x + 6, y + 12, 4, 1);
}

function table(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = WOOD;
  ctx.fillRect(x + 1, y + 1, 14, 13);
}

function printer(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#d8d3c6';
  ctx.fillRect(x + 1, y + 3, 14, 12);
  ctx.fillStyle = '#a9a496';
  ctx.fillRect(x + 1, y + 11, 14, 4);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 4, y, 8, 5);
  ctx.fillStyle = STAMP;
  ctx.fillRect(x + 12, y + 6, 2, 2);
}

function coffeeMachine(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#39343f';
  ctx.fillRect(x + 2, y, 12, 15);
  ctx.fillStyle = STAMP;
  ctx.fillRect(x + 4, y + 2, 8, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(x + 5, y + 7, 6, 6);
  ctx.fillStyle = COFFEE;
  ctx.fillRect(x + 7, y + 9, 2, 4);
}

function whiteboard(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = WALL_TOP;
  ctx.fillRect(x, y, TILE, 5);
  ctx.fillStyle = WALL_FACE;
  ctx.fillRect(x, y + 5, TILE, 11);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x + 1, y + 6, 14, 8);
  ctx.fillStyle = VIOLET;
  ctx.fillRect(x + 3, y + 8, 8, 1);
  ctx.fillRect(x + 3, y + 11, 5, 1);
  ctx.fillStyle = STAMP;
  ctx.fillRect(x + 9, y + 10, 4, 2);
}

function bossDesk(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = '#5a3320';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#7a4a2e';
  ctx.fillRect(x + 1, y + 1, 14, 13);
  ctx.fillStyle = STAMP;
  ctx.fillRect(x + 5, y + 5, 6, 4);
}

export function paintOffice(office: Office): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = charAt(office.tiles, tx, ty);
      const roomIsHard = [',', 'C', 'M'].includes(c) ||
        [charAt(office.tiles, tx - 1, ty), charAt(office.tiles, tx + 1, ty)].includes(',');
      floor(ctx, tx, ty, roomIsHard);
      switch (c) {
        case '#': wall(ctx, office, tx, ty); break;
        case 'D': desk(ctx, tx, ty); break;
        case 'P': plant(ctx, tx, ty); break;
        case 'S': partition(ctx, tx, ty); break;
        case 'F': cabinet(ctx, tx, ty); break;
        case 'T': table(ctx, tx, ty); break;
        case 'M': printer(ctx, tx, ty); break;
        case 'C': coffeeMachine(ctx, tx, ty); break;
        case 'w': whiteboard(ctx, tx, ty); break;
        case 'B': bossDesk(ctx, tx, ty); break;
        default: break;
      }
    }
  }
  return canvas;
}
