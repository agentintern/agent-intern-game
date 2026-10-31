import { describe, expect, it } from 'vitest';
import { TILE } from '../src/core/constants';
import { buildOffice, COLS, distanceField, ROWS, tileIndex } from '../src/levels/office';

const office = buildOffice();
const reach = distanceField(office, office.playerStart.x, office.playerStart.y);
const reachable = (p: { x: number; y: number }): boolean =>
  (reach[tileIndex(Math.floor(p.x / TILE), Math.floor(p.y / TILE))] ?? -1) >= 0;

describe('office map', () => {
  it('is a full rectangle, so no row can leave a hole in a wall', () => {
    expect(office.tiles).toHaveLength(ROWS);
    office.tiles.forEach((row) => expect(row).toHaveLength(COLS));
  });

  it('has solid walls all the way around', () => {
    expect(office.tiles[0]).toBe('#'.repeat(COLS));
    expect(office.tiles[ROWS - 1]).toBe('#'.repeat(COLS));
    office.tiles.forEach((row) => {
      expect(row[0]).toBe('#');
      expect(row[COLS - 1]).toBe('#');
    });
  });

  it('lets you walk to every piece of floor', () => {
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const index = tileIndex(tx, ty);
        if (office.solid[index] === 0) expect(reach[index], `tile ${tx},${ty}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has reachable tasks, coffee and boss route', () => {
    expect(office.taskSpots.length).toBeGreaterThan(30);
    expect(office.coffeeSpots.length).toBeGreaterThanOrEqual(3);
    [...office.taskSpots, ...office.coffeeSpots, ...office.bossRoute].forEach((p) => expect(reachable(p)).toBe(true));
  });
});
