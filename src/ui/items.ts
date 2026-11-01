import type { PowerKind, TaskKind } from '../core/types';
import { box as solid, lit, onLeft, onLid, poly, shade, type BoxStyle, type Tones } from './box';
import { HIGHLIGHT, INK, MINT, PAPER, SKY, STAMP, VIOLET, WHITE } from './palette';
import { speck } from './rooms';

// Things you pick up, and the jam on the floor. Each stands at (0, 0) on the floor and floats on its own.
type Art = CanvasRenderingContext2D;

export type ItemKind = TaskKind | PowerKind | 'coffee';

export interface ItemArt {
  // The color of its glow.
  glow: string;
  // Its name tag.
  tag: string;
  draw: (c: Art) => void;
}

const LIFT = 7;

// Pickups aren't furniture, so a plain color here means the color itself and not its night version.
const box = (c: Art, x: number, y: number, z: number, w: number, d: number, h: number, color: string | Tones, style?: BoxStyle): void =>
  solid(c, x, y, z, w, d, h, typeof color === 'string' ? lit(color) : color, style);

// A card facing the camera's left, which is how a sheet of paper catches the eye in this view.
function card(c: Art, w: number, h: number, color: string, paint: () => void): void {
  box(c, -w / 2, -0.5, LIFT, w, 1, h, { lid: shade(color, 1.05), left: color, right: shade(color, 0.7) }, { rim: 0.6, fall: 0 });
  onLeft(c, 0.5, () => {
    c.translate(0, -LIFT);
    paint();
  });
}

const ITEMS: Record<ItemKind, ItemArt> = {
  email: {
    glow: SKY, tag: 'EMAIL',
    draw: (c) => card(c, 15, 11, '#dcebf8', () => {
      c.strokeStyle = '#3f7fc4';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-7, -10.6); c.lineTo(0, -5); c.lineTo(7, -10.6);
      c.moveTo(-7, -0.6); c.lineTo(-2.2, -6.6);
      c.moveTo(7, -0.6); c.lineTo(2.2, -6.6);
      c.stroke();
    }),
  },
  sheet: {
    glow: MINT, tag: 'SPREADSHEET',
    draw: (c) => card(c, 13, 14, '#e6f6ee', () => {
      c.fillStyle = '#2f9c6e';
      c.fillRect(-6.5, -14, 13, 3);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) if ((row + col) % 2 === 0) c.fillRect(-5.6 + col * 4, -9.8 + row * 2.4, 3.2, 1.6);
      }
    }),
  },
  report: {
    glow: HIGHLIGHT, tag: 'REPORT',
    draw: (c) => {
      box(c, -6.5, -0.2, LIFT - 1.4, 13, 1.4, 15, '#8a5233', { rim: 0.2 });
      card(c, 12, 14, PAPER, () => {
        c.fillStyle = INK;
        c.fillRect(-4.6, -12, 6, 1.1);
        c.fillStyle = '#7f7866';
        for (let i = 0; i < 4; i++) c.fillRect(-4.6, -9.6 + i * 2.1, 9.2 - i * 1.2, 0.8);
      });
    },
  },
  urgent: {
    glow: STAMP, tag: 'URGENT',
    draw: (c) => card(c, 14, 15, STAMP, () => {
      c.fillStyle = WHITE;
      c.fillRect(-1.2, -13, 2.4, 7.4);
      c.fillRect(-1.2, -4.2, 2.4, 2.4);
      c.strokeStyle = '#ffd0c8';
      c.lineWidth = 0.6;
      c.strokeRect(-6.2, -14.2, 12.4, 13.4);
    }),
  },
  call: {
    glow: VIOLET, tag: 'CALL',
    draw: (c) => {
      box(c, -7, -4, LIFT, 14, 9, 3, '#7a58c4', { rim: 0.5 });
      box(c, -6.4, -3.4, LIFT + 3, 3, 7.6, 2.4, '#a78be6', { rim: 0.6 });
      box(c, 3.4, -3.4, LIFT + 3, 3, 7.6, 2.4, '#a78be6', { rim: 0.6 });
      box(c, -6.4, -3.4, LIFT + 5.4, 12.8, 2.4, 1.6, '#a78be6', { rim: 0.6 });
      onLid(c, LIFT + 3, () => {
        c.fillStyle = '#efe7ff';
        for (let i = 0; i < 9; i++) c.fillRect(-2.2 + (i % 3) * 1.6, -0.4 + Math.floor(i / 3) * 1.5, 1, 1);
      });
    },
  },
  project: {
    glow: HIGHLIGHT, tag: 'PROJECT',
    draw: (c) => {
      box(c, -8, -0.4, LIFT, 16, 1, 12, '#c98f1f', { rim: 0.3, fall: 0 });
      box(c, -8, -0.4, LIFT + 12, 7, 1, 2, '#c98f1f', { rim: 0.3, fall: 0 });
      card(c, 15, 10.6, HIGHLIGHT, () => {
        c.fillStyle = '#8a5a12';
        c.fillRect(-4.5, -8, 9, 1.2);
        c.fillRect(-4.5, -5.6, 6, 1.2);
      });
    },
  },
  coffee: {
    glow: SKY, tag: 'COFFEE',
    draw: (c) => {
      const z = 2;
      const oval = (y: number, rx: number, ry: number, color: string): void => {
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      };
      oval(-z, 10, 5, '#d9d2c2');
      c.fillStyle = '#f7f1e4';
      c.beginPath();
      c.moveTo(-6, -z - 11);
      c.lineTo(-5.2, -z - 1);
      c.quadraticCurveTo(0, -z + 3, 5.2, -z - 1);
      c.lineTo(6, -z - 11);
      c.closePath();
      c.fill();
      c.strokeStyle = '#e7e0d0';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(7, -z - 6.4, 3, -1.4, 1.4);
      c.stroke();
      oval(-z - 11, 6, 3, '#e7e0d0');
      oval(-z - 10.8, 4.9, 2.3, '#6b3a20');
      c.strokeStyle = 'rgba(220,235,255,0.6)';
      c.lineWidth = 0.9;
      c.lineCap = 'round';
      for (const x of [-2, 2]) {
        c.beginPath();
        c.moveTo(x, -z - 14);
        c.bezierCurveTo(x - 2, -z - 16, x + 2, -z - 18, x, -z - 21);
        c.stroke();
      }
    },
  },
  headphones: {
    glow: MINT, tag: 'HEADPHONES',
    draw: (c) => {
      const z = LIFT + 6;
      c.strokeStyle = '#2b2e38';
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(0, -z, 7, Math.PI, 0);
      c.stroke();
      c.strokeStyle = MINT;
      c.lineWidth = 1;
      c.stroke();
      for (const x of [-7, 7]) {
        c.fillStyle = '#2b2e38';
        c.fillRect(x - 2.6, -z - 1, 5.2, 8.4);
        c.fillStyle = MINT;
        c.fillRect(x - 1.6, -z, 3.2, 6.4);
      }
    },
  },
  'auto-reply': {
    glow: MINT, tag: 'AUTO-REPLY',
    draw: (c) => card(c, 16, 12, WHITE, () => {
      c.fillStyle = '#2f9c6e';
      c.fillRect(-8, -12, 16, 3);
      c.strokeStyle = '#2f9c6e';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(4.6, -3.2);
      c.lineTo(-3.2, -3.2);
      c.moveTo(-0.6, -6);
      c.lineTo(-3.4, -3.2);
      c.lineTo(-0.6, -0.6);
      c.stroke();
    }),
  },
  stapler: {
    glow: '#ff7a5a', tag: 'STAPLER',
    draw: (c) => {
      const z = LIFT;
      box(c, -9, -3, z, 18, 6, 1.5, '#23252f', { rim: 0.4 });
      box(c, 7, -2.4, z + 1.5, 2.2, 4.8, 3.6, '#30343f', { rim: 0.3 });
      box(c, -8, -2.5, z + 3.4, 16, 5, 2.6, STAMP, { rim: 0.8, fall: 0.1 });
      box(c, -9.4, -2.1, z + 2.4, 2.4, 4.2, 1.4, '#c4c9d2', { rim: 0.6 });
      box(c, -4.5, -1.8, z + 6, 8, 3.6, 0.7, '#ff6a58', { rim: 0.6 });
    },
  },
};

export const itemArt = (kind: ItemKind): ItemArt => ITEMS[kind];
export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

// Paper across the blocked tile, hazard tape around it and a post at each corner. Drawn on the fly, since the
// tile comes and goes. (0, 0) is the middle of the tile.
export function drawJam(c: Art, blink: boolean): void {
  const R = 7.6;
  onLid(c, 0.2, () => {
    c.fillStyle = 'rgba(217,64,47,0.28)';
    c.fillRect(-R, -R, R * 2, R * 2);
    for (let i = 0; i < 16; i++) {
      c.save();
      c.translate((speck(i, 1, 2) - 0.5) * 13, (speck(i, 2, 3) - 0.5) * 13);
      c.rotate(speck(i, 3, 4) * 6.3);
      c.fillStyle = i % 3 === 0 ? '#d8cdb2' : '#fbf3df';
      c.fillRect(-2.8, -3.6, 5.6, 7.2);
      c.fillStyle = 'rgba(40,40,50,0.32)';
      c.fillRect(-1.8, -2.4, 3.6, 0.5);
      c.fillRect(-1.8, -1, 2.6, 0.5);
      c.restore();
    }
  });
  box(c, -3.4, -3, 0, 7, 6.2, 2.8, '#fbf3df', { rim: 0.5, fall: 0.2 });
  box(c, -2.6, -2.2, 2.8, 5.6, 5, 1.4, '#ffffff', { rim: 0.5 });
  const POST = 10;
  for (const [x, y] of [[-R, -R], [R, -R], [-R, R], [R, R]] as const) {
    box(c, x - 0.8, y - 0.8, 0, 1.6, 1.6, POST, '#ffd84a', { rim: 0.4, fall: 0.1 });
    box(c, x - 1.5, y - 1.5, 0, 3, 3, 0.8, '#23252f', { rim: 0.2 });
  }
  const tape = (ax: number, ay: number, bx: number, by: number): void => {
    poly(c, [ax, ay, POST - 0.6], [bx, by, POST - 0.6], [bx, by, POST - 3.2], [ax, ay, POST - 3.2]);
    c.save();
    c.clip();
    c.fillStyle = '#ffd84a';
    c.fillRect(-40, -40, 80, 80);
    c.fillStyle = '#1c1a26';
    for (let i = -44; i < 44; i += 5) {
      c.beginPath();
      c.moveTo(i, -40); c.lineTo(i + 2.5, -40); c.lineTo(i + 42.5, 40); c.lineTo(i + 40, 40);
      c.closePath();
      c.fill();
    }
    c.restore();
  };
  tape(-R, -R, R, -R);
  tape(-R, -R, -R, R);
  tape(-R, R, R, R);
  tape(R, -R, R, R);
  c.fillStyle = blink ? '#ff5a48' : '#7a2018';
  c.beginPath();
  c.arc(0, -8.6, 1.5, 0, Math.PI * 2);
  c.fill();
}
