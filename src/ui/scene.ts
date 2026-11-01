import { TILE } from '../core/constants';
import { charAt, COLS, ROWS, type Office } from '../levels/office';
import { alpha, box, night, onLeft, onLid, onRight, poly, shade, tones } from './box';
import { worldToScreen, WORLD_H, WORLD_W } from './iso';
import { POSTERS } from './jokes';
import { drawText, textWidth } from './font';
import { ART, GLOW, hasLamp, type Place } from './props';
import { canvasOf, cityView, paintFloor, softShadows, speck } from './rooms';

// The building, floor to wall, painted once. Only what moves is drawn again each frame.
export interface Scene {
  canvas: HTMLCanvasElement;
  zoom: number;
  // Where screen point (0, 0) of the iso view lands on the canvas, in canvas pixels.
  originX: number;
  originY: number;
}

export const WALL_H = 62;
const SLAB = 30;
const MARGIN = 96;

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  gain: number;
}

export interface Pane {
  wall: 'north' | 'west';
  from: number;
  length: number;
}

export const LEFT = -WORLD_H - MARGIN;
export const RIGHT = WORLD_W + MARGIN;
export const CEILING = -WALL_H - MARGIN;
export const BELOW = (WORLD_W + WORLD_H) / 2 + SLAB + MARGIN;

// Windows along the two back walls, in tiles. Set to miss the posters and the corners.
export const PANES: readonly Pane[] = [
  { wall: 'north', from: 4, length: 3 },
  ...[9, 13, 18, 22, 28].map((from) => ({ wall: 'north' as const, from, length: 3 })),
  { wall: 'north', from: 34, length: 4 },
  { wall: 'west', from: 2, length: 4 },
  ...[8, 12, 16].map((from) => ({ wall: 'west' as const, from, length: 3 })),
  { wall: 'west', from: 21, length: 4 },
];

export function placeAt(office: Office, tx: number, ty: number): Place {
  return {
    tx, ty, x: tx * TILE, y: ty * TILE, n: speck(tx, ty, 11),
    at: (dx, dy) => charAt(office.tiles, tx + dx, ty + dy),
  };
}

export function lightsOf(office: Office): Light[] {
  const lights: Light[] = [];
  const warm = (x: number, y: number, radius: number, gain: number): void => {
    lights.push({ x, y, radius, color: GLOW.lamp, gain });
  };
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = charAt(office.tiles, tx, ty);
      if (c === 'D' && hasLamp(tx, ty)) warm(tx * TILE + 13, ty * TILE + 8, 50, 0.62);
    }
  }
  warm(4 * TILE, 3.4 * TILE, 62, 0.5);
  warm(37 * TILE, 3 * TILE, 58, 0.62);
  warm(19 * TILE, 13.6 * TILE, 72, 0.55);
  warm(6 * TILE, 23 * TILE, 76, 0.5);
  warm(32 * TILE, 23 * TILE, 70, 0.34);
  warm(20 * TILE, 23 * TILE, 62, 0.34);
  return lights;
}

// Night and rain, with the city far below the floor.
function nightOutside(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, CEILING, 0, BELOW);
  // It fades back to the same dark at both ends, so a tall screen can look past the painted edge.
  g.addColorStop(0, '#0a0c17');
  g.addColorStop(0.72, '#12142a');
  g.addColorStop(1, '#0a0c17');
  ctx.fillStyle = g;
  ctx.fillRect(LEFT, CEILING, RIGHT - LEFT, BELOW - CEILING);
  for (let i = 0; i < 70; i++) {
    const x = LEFT + speck(i, 1, 2) * (RIGHT - LEFT);
    const y = BELOW - speck(i, 2, 3) * speck(i, 5, 6) * 240;
    const r = 3 + speck(i, 3, 4) * 7;
    const color = speck(i, 4, 5) > 0.45 ? '#ffb86b' : '#5f7fc6';
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, alpha(color, 0.14));
    glow.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = 'rgba(150,175,220,0.05)';
  for (let i = 0; i < 260; i++) {
    ctx.fillRect(LEFT + speck(i, 8, 1) * (RIGHT - LEFT), CEILING + speck(i, 9, 2) * (BELOW - CEILING), 0.3, 5 + speck(i, 7, 3) * 8);
  }
}

function drawSlab(ctx: CanvasRenderingContext2D): void {
  const W = WORLD_W;
  const H = WORLD_H;
  const corner = worldToScreen(W, H);
  const under = ctx.createRadialGradient(corner.x, corner.y + 60, 10, corner.x, corner.y + 60, 420);
  under.addColorStop(0, 'rgba(60,70,120,0.2)');
  under.addColorStop(1, 'rgba(60,70,120,0)');
  ctx.fillStyle = under;
  ctx.fillRect(LEFT, 0, RIGHT - LEFT, BELOW);
  const concrete = tones('#8a8f9c');
  const trim = (length: number, glow: number): void => {
    ctx.fillStyle = `rgba(255,214,150,${glow})`;
    ctx.fillRect(0, 8, length, 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < length; i += TILE * 2) ctx.fillRect(i, 0, 0.5, SLAB);
  };
  poly(ctx, [0, H, 0], [W, H, 0], [W, H, -SLAB], [0, H, -SLAB]);
  const left = ctx.createLinearGradient(0, corner.y, 0, corner.y + SLAB);
  left.addColorStop(0, concrete.left);
  left.addColorStop(1, shade(concrete.left, 0.5));
  ctx.fillStyle = left;
  ctx.fill();
  poly(ctx, [W, 0, 0], [W, H, 0], [W, H, -SLAB], [W, 0, -SLAB]);
  ctx.fillStyle = shade(concrete.right, 0.82);
  ctx.fill();
  onLeft(ctx, H, () => trim(W, 0.5));
  onRight(ctx, W, () => trim(H, 0.32));
}

function drawBackWalls(ctx: CanvasRenderingContext2D): void {
  const W = WORLD_W;
  const H = WORLD_H;
  const I = TILE;
  const paint = night('#e6d7ba');
  poly(ctx, [I, I, WALL_H], [W, I, WALL_H], [W, I, 0], [I, I, 0]);
  ctx.fillStyle = shade(paint, 0.82);
  ctx.fill();
  poly(ctx, [I, I, WALL_H], [I, H, WALL_H], [I, H, 0], [I, I, 0]);
  ctx.fillStyle = shade(paint, 0.66);
  ctx.fill();

  const dressed = (length: number): void => {
    const g = ctx.createLinearGradient(0, -WALL_H, 0, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(I, -WALL_H, length - I, WALL_H);
    ctx.fillStyle = night('#3a3f4e');
    ctx.fillRect(I, -3, length - I, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.016)';
    for (let i = I; i < length; i += 7) ctx.fillRect(i, -WALL_H, 3, WALL_H);
  };
  onLeft(ctx, I, () => {
    dressed(W);
    for (const pane of PANES) if (pane.wall === 'north') cityView(ctx, pane.from * TILE, pane.length * TILE, WALL_H, pane.from);
    for (const poster of POSTERS) {
      if (poster.ty !== 0) continue;
      const w = textWidth(poster.text) + 6;
      const x = poster.tx * TILE - 8;
      ctx.fillStyle = night('#f5edd8');
      ctx.fillRect(x, -35, w, 12);
      drawText(ctx, poster.text, x + 3, -32.4, night('#d9402f'));
    }
  });
  onRight(ctx, I, () => {
    dressed(H);
    for (const pane of PANES) if (pane.wall === 'west') cityView(ctx, pane.from * TILE, pane.length * TILE, WALL_H, pane.from + 40);
  });
  const cap = '#26232f';
  poly(ctx, [0, 0, WALL_H], [W, 0, WALL_H], [W, I, WALL_H], [0, I, WALL_H]);
  ctx.fillStyle = cap;
  ctx.fill();
  poly(ctx, [0, 0, WALL_H], [I, 0, WALL_H], [I, H, WALL_H], [0, H, WALL_H]);
  ctx.fill();
  poly(ctx, [W, 0, WALL_H], [W, I, WALL_H], [W, I, 0], [W, 0, 0]);
  ctx.fillStyle = shade(paint, 0.42);
  ctx.fill();
  poly(ctx, [0, H, WALL_H], [I, H, WALL_H], [I, H, 0], [0, H, 0]);
  ctx.fillStyle = shade(paint, 0.56);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,233,200,0.5)';
  ctx.lineWidth = 0.6;
  const a = worldToScreen(I, H, WALL_H);
  const b = worldToScreen(I, I, WALL_H);
  const c = worldToScreen(W, I, WALL_H);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

// Posters hang on the low walls too, facing into the rooms below them.
function wallPoster(ctx: CanvasRenderingContext2D, text: string, x: number): void {
  onLeft(ctx, 20 * TILE, () => {
    const w = textWidth(text) + 5;
    ctx.fillStyle = night('#f5edd8');
    ctx.fillRect(x + 2, -11.5, w, 9.6);
    drawText(ctx, text, x + 4.5, -10.4, night('#d9402f'));
  });
}

function pool(ctx: CanvasRenderingContext2D, light: Light, gain: number): void {
  const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
  g.addColorStop(0, alpha(light.color, gain));
  g.addColorStop(0.45, alpha(light.color, gain * 0.36));
  g.addColorStop(1, alpha(light.color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
}

function windowLight(ctx: CanvasRenderingContext2D): void {
  for (const pane of PANES) {
    const from = pane.from * TILE;
    const length = pane.length * TILE;
    const reach = 9 * TILE;
    const north = pane.wall === 'north';
    const g = north ? ctx.createLinearGradient(0, TILE, 0, TILE + reach) : ctx.createLinearGradient(TILE, 0, TILE + reach, 0);
    g.addColorStop(0, alpha(GLOW.window, 0.3));
    g.addColorStop(1, alpha(GLOW.window, 0));
    ctx.fillStyle = g;
    if (north) ctx.fillRect(from, TILE, length, reach);
    else ctx.fillRect(TILE, from, reach, length);
  }
}

function bloom(ctx: CanvasRenderingContext2D, office: Office): void {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (charAt(office.tiles, tx, ty) !== 'D') continue;
      const at = worldToScreen(tx * TILE + 8, ty * TILE + 6, 17);
      const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 16);
      g.addColorStop(0, alpha(GLOW.screen, 0.13));
      g.addColorStop(1, alpha(GLOW.screen, 0));
      ctx.fillStyle = g;
      ctx.fillRect(at.x - 16, at.y - 16, 32, 32);
      if (hasLamp(tx, ty)) {
        const bulb = worldToScreen(tx * TILE + 12.6, ty * TILE + 4.4, 18.6);
        const warm = ctx.createRadialGradient(bulb.x, bulb.y, 0, bulb.x, bulb.y, 12);
        warm.addColorStop(0, alpha(GLOW.lamp, 0.34));
        warm.addColorStop(1, alpha(GLOW.lamp, 0));
        ctx.fillStyle = warm;
        ctx.fillRect(bulb.x - 12, bulb.y - 12, 24, 24);
      }
    }
  }
}

export function bakeScene(office: Office, zoom: number): Scene {
  const [canvas, ctx] = canvasOf((RIGHT - LEFT) * zoom, (BELOW - CEILING) * zoom);
  const originX = -LEFT * zoom;
  const originY = -CEILING * zoom;
  ctx.setTransform(zoom, 0, 0, zoom, originX, originY);
  ctx.imageSmoothingQuality = 'high';

  nightOutside(ctx);
  drawSlab(ctx);

  const shadows = softShadows(office, (c, tx, ty) => (c === '#' && (tx >= 39 || ty >= 27) ? 0 : (ART[c]?.foot ?? 0)));
  const lights = lightsOf(office);
  const floor = paintFloor(shadows, (c) => {
    windowLight(c);
    for (const light of lights) pool(c, light, light.gain);
  });
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, 0, 0);
  ctx.drawImage(floor, 0, 0, WORLD_W, WORLD_H);
  ctx.restore();

  drawBackWalls(ctx);
  for (let sum = 0; sum < COLS + ROWS; sum++) {
    for (let tx = Math.max(0, sum - ROWS + 1); tx <= Math.min(COLS - 1, sum); tx++) {
      const ty = sum - tx;
      ART[charAt(office.tiles, tx, ty)]?.draw?.(ctx, placeAt(office, tx, ty));
      for (const poster of POSTERS) {
        const from = Math.max(1, poster.tx) * TILE;
        if (poster.ty === ty && ty > 0 && Math.floor((from + textWidth(poster.text) + 6) / TILE) === tx) wallPoster(ctx, poster.text, from);
      }
    }
  }

  // Lamps touch the furniture too, gently, on top of what the floor already took.
  ctx.globalCompositeOperation = 'lighter';
  onLid(ctx, 0, () => {
    for (const light of lights) pool(ctx, light, light.gain * 0.13);
  });
  bloom(ctx, office);
  ctx.globalCompositeOperation = 'multiply';
  const mid = worldToScreen(WORLD_W / 2, WORLD_H / 2);
  const corners = ctx.createRadialGradient(mid.x, mid.y, 160, mid.x, mid.y, 720);
  corners.addColorStop(0, '#ffffff');
  corners.addColorStop(1, '#7a7a98');
  ctx.fillStyle = corners;
  ctx.fillRect(LEFT, CEILING, RIGHT - LEFT, BELOW - CEILING);
  ctx.globalCompositeOperation = 'source-over';
  // The painted edge melts into the plain dark a tall screen sees past it.
  const fade = ctx.createLinearGradient(0, BELOW - 70, 0, BELOW);
  fade.addColorStop(0, 'rgba(10,12,23,0)');
  fade.addColorStop(0.9, 'rgba(10,12,23,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(LEFT, BELOW - 70, RIGHT - LEFT, 74);
  return { canvas, zoom, originX, originY };
}
