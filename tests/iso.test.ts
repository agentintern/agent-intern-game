import { describe, expect, it } from 'vitest';
import { PLAYER_SPEED, STEP, TILE } from '../src/core/constants';
import { createWorld, step } from '../src/core/sim';
import { buildOffice, COLS, ROWS } from '../src/levels/office';
import { drawBossFigure, drawInvite, drawRobot } from '../src/ui/actors';
import { keysToScreen, screenDirToWorld, screenToWorld, viewFor, worldToScreen } from '../src/ui/iso';
import { ART, type Place } from '../src/ui/props';

// A drawing surface that counts what lands on it, so art can run with no browser.
function surface(): { ctx: CanvasRenderingContext2D; marks: () => number } {
  let marks = 0;
  const mark = (): void => { marks++; };
  const skip = (): void => {};
  const gradient = { addColorStop: skip };
  const ctx = {
    fill: mark, stroke: mark, fillRect: mark, strokeRect: mark, beginPath: skip, closePath: skip, moveTo: skip, lineTo: skip,
    quadraticCurveTo: skip, bezierCurveTo: skip, arc: skip, ellipse: skip, clip: skip, save: skip, restore: skip,
    transform: skip, translate: skip, rotate: skip, scale: skip, createLinearGradient: () => gradient, getTransform: () => ({ a: 1 }),
  };
  return { ctx: ctx as object as CanvasRenderingContext2D, marks: () => marks };
}

const place = (office: ReturnType<typeof buildOffice>, tx: number, ty: number): Place => ({
  tx, ty, x: tx * TILE, y: ty * TILE, n: 0.5, at: (dx, dy) => office.tiles[ty + dy]?.[tx + dx] ?? '#',
});

describe('the projection', () => {
  it('goes from the world to the screen and back', () => {
    for (const [x, y] of [[0, 0], [16, 300], [639, 447], [-5, 12.5]] as const) {
      const at = worldToScreen(x, y);
      const back = screenToWorld(at.x, at.y);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
    }
    expect(worldToScreen(10, 10, 6).y).toBe(worldToScreen(10, 10).y - 6);
  });

  it('runs 2:1, with a tile twice as wide as it is tall', () => {
    const a = worldToScreen(0, 0);
    expect(worldToScreen(TILE, 0).x - a.x).toBe(TILE);
    expect(worldToScreen(TILE, 0).y - a.y).toBe(TILE / 2);
  });
});

describe('the controls', () => {
  it('keeps the length of a push, so world speed cannot change', () => {
    for (const [x, y] of [[0, -1], [1, 0], [0.6, 0.8], [-0.55, 0], [0.3, -0.2]] as const) {
      const dir = screenDirToWorld(x, y);
      expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(Math.hypot(x, y));
    }
    expect(screenDirToWorld(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('moves a push on screen that way on screen', () => {
    for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, 0.7]] as const) {
      const dir = screenDirToWorld(x, y);
      const on = worldToScreen(dir.x, dir.y);
      expect(Math.atan2(on.y, on.x)).toBeCloseTo(Math.atan2(y, x));
    }
  });

  it('runs along an aisle with two keys held', () => {
    const pushed = keysToScreen(1, -1);
    const dir = screenDirToWorld(pushed.x, pushed.y);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.y).toBeLessThan(0);
  });

  it('gets the same world speed in every screen direction', () => {
    const paces = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([x, y]) => {
      const world = createWorld(5);
      Object.assign(world.player, { x: 20 * TILE, y: 16.5 * TILE });
      world.tasks.length = 0;
      const dir = screenDirToWorld(x as number, y as number);
      const from = { x: world.player.x, y: world.player.y };
      step(world, { moveX: dir.x, moveY: dir.y, dash: false });
      return Math.hypot(world.player.x - from.x, world.player.y - from.y);
    });
    for (const pace of paces) expect(pace).toBeCloseTo(PLAYER_SPEED * STEP);
  });

  it('shows the view that matches the way a character moved', () => {
    expect(viewFor(1, 0, 'nw')).toBe('se');
    expect(viewFor(0, 1, 'nw')).toBe('sw');
    expect(viewFor(-1, 0, 'se')).toBe('nw');
    expect(viewFor(0, -1, 'se')).toBe('ne');
    expect(viewFor(0, 0, 'ne')).toBe('ne');
  });
});

describe('the art', () => {
  it('has art that paints for every character on the map', () => {
    const office = buildOffice();
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const c = office.tiles[ty]?.[tx] as string;
        const art = ART[c];
        expect(art, `no art for ${c}`).toBeDefined();
        if (office.solid[ty * COLS + tx] === 0 || tx === 0 || ty === 0) continue;
        const { ctx, marks } = surface();
        art?.draw?.(ctx, place(office, tx, ty));
        expect(marks(), `${c} at ${tx},${ty} drew nothing`).toBeGreaterThan(0);
      }
    }
  });

  it('draws every person in all four views, and a stapled meeting apart from a free one', () => {
    for (const view of ['se', 'sw', 'nw', 'ne'] as const) {
      for (const draw of [drawRobot, drawBossFigure]) {
        const { ctx, marks } = surface();
        draw(ctx, { view, stride: 0.25, dash: true, tired: true, stunned: false });
        expect(marks()).toBeGreaterThan(20);
      }
    }
    const free = surface();
    const stapled = surface();
    drawInvite(free.ctx, 0, false);
    drawInvite(stapled.ctx, 0, true);
    expect(stapled.marks()).toBeGreaterThan(free.marks());
  });
});
