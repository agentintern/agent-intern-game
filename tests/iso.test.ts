import { describe, expect, it } from 'vitest';
import { PLAYER_SPEED, STEP, TILE } from '../src/core/constants';
import { createWorld, step } from '../src/core/sim';
import type { PowerKind, TaskKind, World } from '../src/core/types';
import { buildOffice, COLS, ROWS } from '../src/levels/office';
import { drawBossFigure, drawInvite, drawRobot } from '../src/ui/actors';
import { keysToScreen, screenDirToWorld, screenToWorld, viewFor, worldToScreen } from '../src/ui/iso';
import { drawJam, itemArt, ITEM_KINDS } from '../src/ui/items';
import { ART, type Place } from '../src/ui/props';
import { drawOrder, thingsIn, type Thing } from '../src/ui/stage';

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

  it('has art that paints for every pickup', () => {
    const powers: PowerKind[] = ['headphones', 'auto-reply', 'stapler'];
    const tasks: TaskKind[] = ['email', 'sheet', 'report', 'urgent', 'call', 'project'];
    for (const kind of [...powers, ...tasks, 'coffee' as const]) {
      expect(ITEM_KINDS).toContain(kind);
      const { ctx, marks } = surface();
      itemArt(kind).draw(ctx);
      expect(marks(), kind).toBeGreaterThan(0);
      expect(itemArt(kind).tag.length).toBeGreaterThan(0);
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

describe('what the frame holds', () => {
  const isJam = (t: Thing): boolean => t.kind === 'jam';

  it('shows a jam only while the printer is jammed', () => {
    const world = createWorld(11);
    const { ctx, marks } = surface();
    drawJam(ctx, true);
    expect(marks()).toBeGreaterThan(10);
    let jammed = 0;
    for (let i = 0; i < 90 * 60 && world.phase === 'playing'; i++) {
      world.events.length = 0;
      step(world, { moveX: 0, moveY: 0, dash: false });
      const open = world.printers.filter((p) => p.jamT > 0).length;
      expect(thingsIn(world).filter(isJam)).toHaveLength(open);
      jammed += open;
    }
    expect(jammed).toBeGreaterThan(0);
  });

  function around(tx: number, ty: number, dx: number, dy: number): { order: Thing[]; world: World } {
    const world = createWorld(3);
    world.tasks.length = 0;
    world.meetings.length = 0;
    Object.assign(world.boss, { x: 2 * TILE, y: 2 * TILE });
    Object.assign(world.player, { x: tx * TILE + dx, y: ty * TILE + dy });
    return { order: drawOrder(world, world.office), world };
  }

  it('sorts a character behind furniture it stands behind, and in front of furniture it has passed', () => {
    const office = buildOffice();
    const desk = { tx: 17, ty: 9 };
    expect(office.tiles[desk.ty]?.[desk.tx]).toBe('D');
    const tileAt = (order: Thing[]): number => order.findIndex((t) => t.kind === 'tile' && t.tx === desk.tx && t.ty === desk.ty);
    const playerAt = (order: Thing[]): number => order.findIndex((t) => t.kind === 'player');

    const behind = around(desk.tx, desk.ty, 8, -5);
    expect(tileAt(behind.order)).toBeGreaterThan(playerAt(behind.order));

    const west = around(desk.tx, desk.ty, -5, 8);
    expect(tileAt(west.order)).toBeGreaterThan(playerAt(west.order));

    expect(tileAt(around(desk.tx, desk.ty, 8, TILE + 5).order)).toBe(-1);
    expect(tileAt(around(desk.tx + 1, desk.ty, TILE + 5, 8).order)).toBe(-1);
  });

  it('never lists a tile twice, and shows what matters through tall furniture', () => {
    const { order } = around(16, 9, 8, -5);
    const tiles = order.filter((t): t is Thing & { kind: 'tile' } => t.kind === 'tile');
    expect(new Set(tiles.map((t) => t.tx * 100 + t.ty)).size).toBe(tiles.length);
    expect(tiles.some((t) => t.see)).toBe(true);
  });
});
