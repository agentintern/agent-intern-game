import { worldToScreen } from './iso';

// Every solid thing in the office starts here. One light, from above and behind the camera's left shoulder.
export interface Tones {
  lid: string;
  left: string;
  right: string;
}

export interface BoxStyle {
  // Faces covered by a neighbor, so a long desk has no seams.
  noLeft?: boolean;
  noRight?: boolean;
  noLid?: boolean;
  // How much the sides darken toward the floor, 0 to 1.
  fall?: number;
  // How bright the lit edges are, 0 to 1.
  rim?: number;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function shade(hex: string, factor: number): string {
  const [r, g, b] = rgb(hex).map((v) => Math.round(Math.max(0, Math.min(255, v * factor)))) as [number, number, number];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  const at = (i: number): number => Math.round((ca[i] as number) * (1 - t) + (cb[i] as number) * t);
  return `#${((1 << 24) | (at(0) << 16) | (at(1) << 8) | at(2)).toString(16).slice(1)}`;
}

export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

// Everything is lit for night, so a color is named as it would look by day and only glows stay as they are.
export function night(hex: string): string {
  const [r, g, b] = rgb(hex);
  return `#${((1 << 24) | (Math.round(r * 0.6) << 16) | (Math.round(g * 0.64) << 8) | Math.round(b * 0.8)).toString(16).slice(1)}`;
}

export const tones = (hex: string): Tones => {
  const dark = night(hex);
  return { lid: shade(dark, 1.12), left: shade(dark, 0.78), right: shade(dark, 0.58) };
};

// People and pickups stay brighter than the room, or they'd sink into the night.
export const lit = (hex: string): Tones => ({ lid: shade(hex, 1.04), left: shade(hex, 0.86), right: shade(hex, 0.64) });

export function poly(ctx: CanvasRenderingContext2D, ...points: readonly (readonly [number, number, number])[]): void {
  ctx.beginPath();
  points.forEach(([x, y, z], i) => {
    const p = worldToScreen(x, y, z);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

function side(ctx: CanvasRenderingContext2D, color: string, fall: number, bottom: number, height: number): void {
  if (fall <= 0 || height <= 0) {
    ctx.fillStyle = color;
    return;
  }
  const g = ctx.createLinearGradient(0, bottom - height, 0, bottom);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, 1 - fall));
  ctx.fillStyle = g;
}

export function box(
  ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number,
  color: string | Tones, style: BoxStyle = {},
): void {
  const t = typeof color === 'string' ? tones(color) : color;
  const { fall = 0.34, rim = 0.5 } = style;
  const x2 = x + w;
  const y2 = y + d;
  const z2 = z + h;

  if (!style.noLeft && h > 0) {
    poly(ctx, [x, y2, z2], [x2, y2, z2], [x2, y2, z], [x, y2, z]);
    side(ctx, t.left, fall, worldToScreen(x2, y2, z).y, h);
    ctx.fill();
  }
  if (!style.noRight && h > 0) {
    poly(ctx, [x2, y, z2], [x2, y2, z2], [x2, y2, z], [x2, y, z]);
    side(ctx, t.right, fall, worldToScreen(x2, y2, z).y, h);
    ctx.fill();
  }
  if (!style.noLid) {
    poly(ctx, [x, y, z2], [x2, y, z2], [x2, y2, z2], [x, y2, z2]);
    ctx.fillStyle = t.lid;
    ctx.fill();
  }
  if (rim > 0) {
    ctx.strokeStyle = `rgba(255,244,224,${rim * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const a = worldToScreen(x, y2, z2);
    const b = worldToScreen(x2, y2, z2);
    const c = worldToScreen(x2, y, z2);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
}

// A flat decal on the side of a box, in (along, up) coordinates of that face.
export function onLeft(ctx: CanvasRenderingContext2D, y: number, draw: () => void): void {
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, -y, y / 2);
  draw();
  ctx.restore();
}

export function onRight(ctx: CanvasRenderingContext2D, x: number, draw: () => void): void {
  ctx.save();
  ctx.transform(-1, 0.5, 0, 1, x, x / 2);
  draw();
  ctx.restore();
}

// A flat decal on the floor or on a lid, in world coordinates at height z.
export function onLid(ctx: CanvasRenderingContext2D, z: number, draw: () => void): void {
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, 0, -z);
  draw();
  ctx.restore();
}
