import { PIXELS } from './palette';

export type Sprite = HTMLCanvasElement;

function paint(rows: readonly string[]): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...rows.map((r) => r.length));
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PIXELS[row[x] as string];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

function flipped(source: Sprite): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

const INTERN_DOWN = [
  '....hhhhh...',
  '...hhhhhhh..',
  '..hhhhhhhhh.',
  '..htttttth..',
  '..tktttktt..',
  '..ttttttttt.',
  '...ttTTtt...',
  '..wwwrrwww..',
  '.twwwrrwwwt.',
  '.twwwrrwwwt.',
  '..wwwrrwww..',
  '..bbbbbbbb..',
  '..bbb..bbb..',
];
const INTERN_DOWN_B = [...INTERN_DOWN.slice(0, 11), '..bbbbbbbb..', '..kkk..bbb..'];
const INTERN_DOWN_C = [...INTERN_DOWN.slice(0, 11), '..bbbbbbbb..', '..bbb..kkk..'];

const INTERN_UP = [
  '....hhhhh...',
  '...hhhhhhh..',
  '..hhhhhhhhh.',
  '..hhhhhhhhh.',
  '..hhhhhhhhh.',
  '..thhhhhhht.',
  '...ttttt....',
  '..wwwwwwww..',
  '.twwwwwwwwt.',
  '.twwwwwwwwt.',
  '..wwwwwwww..',
  '..bbbbbbbb..',
  '..bbb..bbb..',
];
const INTERN_UP_B = [...INTERN_UP.slice(0, 11), '..bbbbbbbb..', '..kkk..bbb..'];
const INTERN_UP_C = [...INTERN_UP.slice(0, 11), '..bbbbbbbb..', '..bbb..kkk..'];

const INTERN_SIDE = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhhhhhhh.',
  '..hhhttttt..',
  '..hhttttkt..',
  '...tttttttt.',
  '...ttttTT...',
  '...wwwwrr...',
  '...wwwtrw...',
  '...wwwtww...',
  '...wwwwww...',
  '...bbbbbb...',
  '...bb..bb...',
];
const INTERN_SIDE_B = [...INTERN_SIDE.slice(0, 11), '...bbbbbb...', '..kkb..bbk..'];
const INTERN_SIDE_C = [...INTERN_SIDE.slice(0, 11), '...bbbbbb...', '...bbkkbb...'];

const BOSS_DOWN = [
  '....GGGGGG....',
  '...GGGGGGGG...',
  '...tttttttt...',
  '...tkkttkkt...',
  '...tttttttt...',
  '...tkkkkkkt...',
  '....tttttt....',
  '..ggggwwgggg..',
  '.gggggrrggggg.',
  '.gggggrrggggg.',
  '.gggggrrggggg.',
  '.tgggggggggt..',
  '..gggggggggg..',
  '..GGGG..GGGG..',
  '..kkkk..kkkk..',
];
const BOSS_DOWN_B = [...BOSS_DOWN.slice(0, 13), '..GGGG..GGGG..', '........kkkk..'];
const BOSS_DOWN_C = [...BOSS_DOWN.slice(0, 13), '..GGGG..GGGG..', '..kkkk........'];

const MEETING = [
  '.rrrrrrrrrr.',
  'rrwrrrrrrwrr',
  'rrrrrrrrrrrr',
  'pppppppppppp',
  'pkkppppppkkp',
  'ppkkppppkkpp',
  'ppkwppppkwpp',
  'pppppppppppp',
  'pppkkkkkkppp',
  'ppkppppppkpp',
  'pppppppppppp',
  '.pppppppppp.',
];
const MEETING_B = ['............', ...MEETING.slice(0, 11)];

const TASKS: Record<string, readonly string[]> = {
  email: [
    '.sssssssss.',
    'swswwwwwsws',
    'swwswwwswws',
    'swwwsssswws',
    'swwwwwwwwws',
    'swwwwwwwwws',
    '.sssssssss.',
  ],
  sheet: [
    'mmmmmmmmmm.',
    'mwmwmwmwmm.',
    'mmmmmmmmmm.',
    'mwmwmwmwmm.',
    'mmmmmmmmmm.',
    'mwmwmwmwmm.',
    'mmmmmmmmmm.',
  ],
  report: [
    '.ddddddddd.',
    '.pkkkkkkpd.',
    '.pppppppdd.',
    '.pkkkkkppd.',
    '.pppppppdd.',
    '.pkkkkkkpd.',
    '.ppppppppd.',
    '..ddddddd..',
  ],
  urgent: [
    '....rrr....',
    '...rrrrr...',
    '...rrwrr...',
    '..rrrwrrr..',
    '..rrrwrrr..',
    '.rrrrrrrrr.',
    '.rrrrwrrrr.',
    'rrrrrrrrrrr',
  ],
};

const CUP = [
  '..s..s...',
  '...s..s..',
  '..s..s...',
  'pppppppp.',
  'pccccccpp',
  'pccccccp.p',
  'pppppppppp',
  'pppppppp.',
  '.pppppp..',
];

export interface SpriteSet {
  internDown: Sprite[];
  internUp: Sprite[];
  internRight: Sprite[];
  internLeft: Sprite[];
  boss: Sprite[];
  meeting: Sprite[];
  tasks: Record<string, Sprite>;
  cup: Sprite;
}

export function buildSprites(): SpriteSet {
  const internRight = [INTERN_SIDE, INTERN_SIDE_B, INTERN_SIDE_C].map(paint);
  return {
    internDown: [INTERN_DOWN, INTERN_DOWN_B, INTERN_DOWN_C].map(paint),
    internUp: [INTERN_UP, INTERN_UP_B, INTERN_UP_C].map(paint),
    internRight,
    internLeft: internRight.map(flipped),
    boss: [BOSS_DOWN, BOSS_DOWN_B, BOSS_DOWN_C].map(paint),
    meeting: [MEETING, MEETING_B].map(paint),
    tasks: Object.fromEntries(Object.entries(TASKS).map(([k, rows]) => [k, paint(rows)])),
    cup: paint(CUP),
  };
}
