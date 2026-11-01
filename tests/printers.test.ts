import { describe, expect, it } from 'vitest';
import { PRINTER_JAM_SECONDS, RUN_SECONDS, STEP, TILE } from '../src/core/constants';
import { createWorld, step } from '../src/core/sim';
import type { Input } from '../src/core/types';
import { buildOffice, isSolidAt, tileIndex } from '../src/levels/office';

const still: Input = { moveX: 0, moveY: 0, dash: false };

describe('printers', () => {
  it('sits next to open floor so a jam has somewhere to block', () => {
    const office = buildOffice();
    expect(office.printers.length).toBeGreaterThan(0);
    for (const printer of office.printers) {
      const index = tileIndex(printer.blockX, printer.blockY);
      expect(office.solid[index]).toBe(0);
    }
  });

  it('jams now and then, blocking the aisle tile until it clears', () => {
    const world = createWorld(11);
    let sawJam = false;
    let sawClear = false;
    const steps = Math.ceil(RUN_SECONDS / STEP);
    for (let i = 0; i < steps; i++) {
      world.events.length = 0;
      step(world, still);
      const printer = world.printers[0];
      if (!printer) throw new Error('expected a printer');
      const index = tileIndex(printer.blockX, printer.blockY);
      expect(world.office.solid[index]).toBe(printer.jamT > 0 ? 1 : 0);
      if (printer.jamT > 0) sawJam = true;
      if (sawJam && printer.jamT <= 0) sawClear = true;
    }
    expect(sawJam).toBe(true);
    expect(sawClear).toBe(true);
  });

  it('never jams a tile the player is standing on', () => {
    const world = createWorld(23);
    const printer = world.printers[0];
    if (!printer) throw new Error('expected a printer');
    world.player.x = printer.blockX * TILE + TILE / 2;
    world.player.y = printer.blockY * TILE + TILE / 2;
    const steps = Math.ceil(RUN_SECONDS / STEP);
    for (let i = 0; i < steps; i++) {
      step(world, still);
      expect(isSolidAt(world.office, world.player.x, world.player.y)).toBe(false);
    }
  });

  it('clears about PRINTER_JAM_SECONDS after it starts', () => {
    const world = createWorld(31);
    const printer = world.printers[0];
    if (!printer) throw new Error('expected a printer');
    printer.jamT = PRINTER_JAM_SECONDS;
    printer.nextJamT = Infinity;
    const index = tileIndex(printer.blockX, printer.blockY);
    world.office.solid[index] = 1;
    let elapsed = 0;
    while (world.office.solid[index] === 1 && elapsed < PRINTER_JAM_SECONDS + 1) {
      step(world, still);
      elapsed += STEP;
    }
    expect(world.office.solid[index]).toBe(0);
    expect(elapsed).toBeCloseTo(PRINTER_JAM_SECONDS, 1);
  });
});
