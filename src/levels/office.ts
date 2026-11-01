import { TILE } from '../core/constants';

// One tile per character, 40 wide and 28 tall.
//   # wall       . carpet     , hard floor   D desk       P plant
//   S partition  F cabinet    T table        M printer    C coffee machine
//   w whiteboard B boss desk  p player start b boss start
const MAP = [
  '########################################',
  '#......#.......ww.........ww.....#w....#',
  '#.TTTT.#..DD.DD...DD.DD...DD.DD..#..BB.#',
  '#.TTTT.#.........................#..BB.#',
  '#.TTTT.#..DD.DD...DD.DD...DD.DD..#.b...#',
  '#......#.........................#....P#',
  '#P....P#..SSSSS.P.....P..SSSSS...#F...F#',
  '###..###.........................###..##',
  '#......................................#',
  '#..DD.DD...SSSS..DD.DD..SSSS...DD.DD...#',
  '#..........S..............S............#',
  '#..DD.DD...S..P........P..S....DD.DD...#',
  '#..........S..............S............#',
  '#PF........S.....TTTT.....S..........FP#',
  '#..........S.....TTTT.....S............#',
  '#..DD.DD...S.....p........S....DD.DD...#',
  '#..........S..............S............#',
  '#..DD.DD...SSSS..DD.DD..SSSS...DD.DD...#',
  '#......................................#',
  '#####...#####....PP..PP....#####...#####',
  '#,,,,,,,,,,,#..............#,,,,,,,,,,,#',
  '#,C,,,,,,,,,#..DD.DD.DD....#,,M,,,,M,,,#',
  '#,,,,,,,,,,,#..............#,,,,,,,,,,,#',
  '#,,TT,,TT,,,,..DD.DD.DD....,,,,,,,,,,C,#',
  '#,,TT,,TT,,,#..............#,,,,,,,,,,,#',
  '#,,,,,,,,,,,#.....C........#,,F,F,F,F,,#',
  '#P,,,,,,,,,P#..............#P,,,,,,,,,P#',
  '########################################',
];

export const COLS = 40;
export const ROWS = MAP.length;

const SOLID = new Set(['#', 'D', 'P', 'S', 'F', 'T', 'M', 'C', 'w', 'B']);
const BLOCKS_SIGHT = new Set(['#', 'P', 'S', 'F', 'w']);

export interface Point {
  x: number;
  y: number;
}

export interface PrinterSpot {
  x: number;
  y: number;
  blockX: number;
  blockY: number;
}

export interface Office {
  tiles: string[];
  solid: Uint8Array;
  sight: Uint8Array;
  playerStart: Point;
  bossStart: Point;
  taskSpots: Point[];
  coffeeSpots: Point[];
  printers: PrinterSpot[];
  bossRoute: Point[];
}

export const tileCenter = (tx: number, ty: number): Point => ({
  x: tx * TILE + TILE / 2,
  y: ty * TILE + TILE / 2,
});

export const tileIndex = (tx: number, ty: number): number => ty * COLS + tx;

export function charAt(tiles: readonly string[], tx: number, ty: number): string {
  return tiles[ty]?.[tx] ?? '#';
}

export function buildOffice(): Office {
  const solid = new Uint8Array(COLS * ROWS);
  const sight = new Uint8Array(COLS * ROWS);
  let playerStart: Point | null = null;
  let bossStart: Point | null = null;
  const coffeeMachines: Point[] = [];
  const printerMachines: Point[] = [];

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = charAt(MAP, tx, ty);
      solid[tileIndex(tx, ty)] = SOLID.has(c) ? 1 : 0;
      sight[tileIndex(tx, ty)] = BLOCKS_SIGHT.has(c) ? 1 : 0;
      if (c === 'p') playerStart = tileCenter(tx, ty);
      if (c === 'b') bossStart = tileCenter(tx, ty);
      if (c === 'C') coffeeMachines.push({ x: tx, y: ty });
      if (c === 'M') printerMachines.push({ x: tx, y: ty });
    }
  }
  if (!playerStart || !bossStart) throw new Error('the map needs a player and a boss start');

  const isFloor = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    return solid[tileIndex(tx, ty)] === 0;
  };

  // A task sits on the floor right below a desk, where you'd pull up a chair.
  const taskSpots: Point[] = [];
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (charAt(MAP, tx, ty) === 'D' && isFloor(tx, ty + 1)) taskSpots.push(tileCenter(tx, ty + 1));
    }
  }

  const coffeeSpots: Point[] = coffeeMachines.map((m) => {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
      if (isFloor(m.x + dx, m.y + dy)) return tileCenter(m.x + dx, m.y + dy);
    }
    throw new Error('a coffee machine is walled in');
  });

  // The aisle tile a printer jams into is the open floor right next to it.
  const printers: PrinterSpot[] = printerMachines.map((m) => {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
      if (isFloor(m.x + dx, m.y + dy)) {
        const center = tileCenter(m.x, m.y);
        return { x: center.x, y: center.y, blockX: m.x + dx, blockY: m.y + dy };
      }
    }
    throw new Error('a printer is walled in');
  });

  const bossRoute: Point[] = [
    tileCenter(36, 5),
    tileCenter(36, 8),
    tileCenter(20, 8),
    tileCenter(4, 8),
    tileCenter(8, 12),
    tileCenter(8, 18),
    tileCenter(20, 18),
    tileCenter(20, 25),
    tileCenter(30, 23),
    tileCenter(30, 18),
    tileCenter(29, 12),
    tileCenter(20, 11),
    tileCenter(29, 5),
    tileCenter(12, 5),
    tileCenter(29, 5),
  ];

  return { tiles: MAP, solid, sight, playerStart, bossStart, taskSpots, coffeeSpots, printers, bossRoute };
}

export function isSolidAt(office: Office, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return office.solid[tileIndex(tx, ty)] === 1;
}

export function hasLineOfSight(office: Office, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((ax + (bx - ax) * t) / TILE);
    const ty = Math.floor((ay + (by - ay) * t) / TILE);
    if (office.sight[tileIndex(tx, ty)] === 1) return false;
  }
  return true;
}

// Steps-to-goal from every tile. The boss walks downhill on this, and so does the test bot.
export function distanceField(office: Office, goalX: number, goalY: number): Int16Array {
  const field = new Int16Array(COLS * ROWS).fill(-1);
  const goal = tileIndex(Math.floor(goalX / TILE), Math.floor(goalY / TILE));
  const queue = new Int32Array(COLS * ROWS);
  let head = 0;
  let tail = 0;
  field[goal] = 0;
  queue[tail++] = goal;
  while (head < tail) {
    const at = queue[head++] as number;
    const ax = at % COLS;
    const ay = Math.floor(at / COLS);
    const d = (field[at] as number) + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const n = tileIndex(nx, ny);
      if (field[n] !== -1 || office.solid[n] === 1) continue;
      field[n] = d;
      queue[tail++] = n;
    }
  }
  return field;
}

// The next tile center to head for, walking downhill. Null at the goal or if unreachable.
export function nextStep(field: Int16Array, x: number, y: number): Point | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const here = field[tileIndex(tx, ty)] ?? -1;
  if (here <= 0) return null;
  let best: Point | null = null;
  let bestD = here;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const d = field[tileIndex(nx, ny)] ?? -1;
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = tileCenter(nx, ny);
    }
  }
  return best;
}
