import { PLAYER_RADIUS, PRINTER_JAM_MAX, PRINTER_JAM_MIN, PRINTER_JAM_SECONDS, STEP, TILE } from '../core/constants';
import type { Printer, World } from '../core/types';
import { tileIndex } from '../levels/office';

function randomGap(world: World): number {
  return PRINTER_JAM_MIN + world.rng.next() * (PRINTER_JAM_MAX - PRINTER_JAM_MIN);
}

export function createPrinters(world: World): Printer[] {
  return world.office.printers.map((spot) => ({
    x: spot.x,
    y: spot.y,
    blockX: spot.blockX,
    blockY: spot.blockY,
    jamT: 0,
    nextJamT: randomGap(world),
  }));
}

// A jam waits for the aisle to be clear, so it can never trap the player inside a wall.
function playerBlocksTile(world: World, tx: number, ty: number): boolean {
  const { player: p } = world;
  const left = tx * TILE - PLAYER_RADIUS;
  const top = ty * TILE - PLAYER_RADIUS;
  return p.x > left && p.x < left + TILE + PLAYER_RADIUS * 2 && p.y > top && p.y < top + TILE + PLAYER_RADIUS * 2;
}

export function stepPrinters(world: World): void {
  for (const printer of world.printers) {
    const index = tileIndex(printer.blockX, printer.blockY);
    if (printer.jamT > 0) {
      printer.jamT -= STEP;
      if (printer.jamT <= 0) {
        world.office.solid[index] = 0;
        world.events.push({ type: 'printer-clear', x: printer.x, y: printer.y });
      }
      continue;
    }
    printer.nextJamT -= STEP;
    if (printer.nextJamT > 0) continue;
    if (playerBlocksTile(world, printer.blockX, printer.blockY)) {
      printer.nextJamT = 0.25;
      continue;
    }
    printer.jamT = PRINTER_JAM_SECONDS;
    printer.nextJamT = randomGap(world);
    world.office.solid[index] = 1;
    world.events.push({ type: 'printer-jam', x: printer.x, y: printer.y });
  }
}
