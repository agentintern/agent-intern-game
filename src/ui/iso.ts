import { TILE } from '../core/constants';
import { COLS, ROWS } from '../levels/office';

// A 2:1 isometric view. World x runs down and to the right, world y down and to the left, z straight up.
// These are the only two functions that know that. Everything else asks them.
export interface Spot {
  x: number;
  y: number;
}

export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

export function worldToScreen(x: number, y: number, z = 0): Spot {
  return { x: x - y, y: (x + y) / 2 - z };
}

export function screenToWorld(sx: number, sy: number): Spot {
  return { x: sy + sx / 2, y: sy - sx / 2 };
}

// Where a push on the keys or the stick goes, as a world direction of the same length, so speed can't change.
export function screenDirToWorld(mx: number, my: number): Spot {
  const length = Math.hypot(mx, my);
  if (length === 0) return { x: 0, y: 0 };
  const dir = screenToWorld(mx, my);
  const scale = length / Math.hypot(dir.x, dir.y);
  return { x: dir.x * scale, y: dir.y * scale };
}

// Two keys held together run along an aisle, and aisles sit at 2:1 on screen.
export const keysToScreen = (mx: number, my: number): Spot => ({ x: mx, y: mx !== 0 && my !== 0 ? my / 2 : my });

// The four views a character can show, named by the way it faces on screen.
export type View4 = 'se' | 'sw' | 'nw' | 'ne';

export function viewFor(dx: number, dy: number, was: View4): View4 {
  const sx = dx - dy;
  const sy = dx + dy;
  if (Math.abs(sx) < 0.001 && Math.abs(sy) < 0.001) return was;
  const east = Math.abs(sx) < 0.001 ? was === 'se' || was === 'ne' : sx > 0;
  const south = Math.abs(sy) < 0.001 ? was === 'se' || was === 'sw' : sy > 0;
  return south ? (east ? 'se' : 'sw') : east ? 'ne' : 'nw';
}

// Painter's order on the floor. Bigger draws later, nearer the camera.
export const depthOf = (x: number, y: number): number => x + y;
export const tileDepth = (tx: number, ty: number): number => (tx + ty + 1) * TILE;

// A thing on the floor is behind a solid tile unless it has passed the tile's far edge on either axis.
export const tileHides = (tx: number, ty: number, x: number, y: number): boolean =>
  x < (tx + 1) * TILE && y < (ty + 1) * TILE;
