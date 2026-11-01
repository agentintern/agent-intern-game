import { TILE } from '../core/constants';
import { alpha, box, mix, night, onLeft, onLid, onRight, poly, shade, tones, type Tones } from './box';
import { drawText, textWidth } from './font';
import { worldToScreen } from './iso';
import { NOTES } from './jokes';
import { roomAt, speck } from './rooms';

// Everything that stands on a tile of the map, one entry per map character. To add an object, write a
// function that calls box() a few times and give it a character. GAME.md shows one.
type Art = CanvasRenderingContext2D;

export interface Place {
  tx: number;
  ty: number;
  x: number;
  y: number;
  // A steady number from 0 to 1 for this tile, so the same desk always looks the same.
  n: number;
  at: (dx: number, dy: number) => string;
}

export interface TileArt {
  height: number;
  // How much of the tile it covers, for the contact shadow. Zero for bare floor.
  foot: number;
  // How far it spreads from the middle of its tile on screen. A tile is 16 each way.
  spread: number;
  draw?: (c: Art, p: Place) => void;
}

const STEEL = '#aeb7c4';
const STEEL_DARK = '#59626f';
const WOOD = '#a97a50';
const PLASTIC = '#2c2f3a';
const SCREENS = ['#7fe0d2', '#8fc4ff', '#ffd27a', '#9ff0b4'];

export const GLOW = { lamp: '#ffd9a8', screen: '#6fd8ff', red: '#ff5a48', green: '#5fe6a0', window: '#6f97d0' };

export function hasLamp(tx: number, ty: number): boolean {
  return speck(tx, ty, 7) > 0.62;
}

function mug(c: Art, x: number, y: number, z: number, color: string): void {
  box(c, x, y, z, 1.8, 1.8, 2.2, color, { rim: 0.2 });
  box(c, x + 0.4, y + 1.8, z + 0.6, 1, 0.5, 1.1, color, { rim: 0 });
}

function papers(c: Art, x: number, y: number, z: number, w: number, d: number, sheets: number): void {
  for (let i = 0; i < sheets; i++) {
    const drift = speck(x, y, i) * 0.9 - 0.45;
    box(c, x + drift, y - drift, z + i * 0.32, w, d, 0.32, i === sheets - 1 ? '#fbf3df' : '#dfd5be', { rim: 0.1, fall: 0 });
  }
}

function lamp(c: Art, x: number, y: number, z: number): void {
  box(c, x, y, z, 2.6, 2.6, 0.5, STEEL_DARK);
  box(c, x + 1, y + 1, z + 0.5, 0.7, 0.7, 7, STEEL, { rim: 0.2 });
  box(c, x - 1.6, y + 0.2, z + 7, 4.2, 3, 1.6, '#3a3f4e');
  poly(c, [x - 1.4, y + 3.1, z + 7], [x + 2.6, y + 3.1, z + 7], [x + 2.6, y + 0.4, z + 7], [x - 1.4, y + 0.4, z + 7]);
  c.fillStyle = '#ffe9b8';
  c.fill();
}

function monitor(c: Art, p: Place, x: number, y: number, z: number): void {
  box(c, x + 3.5, y + 0.4, z, 4, 2.6, 0.5, PLASTIC, { rim: 0.2 });
  box(c, x + 5, y + 0.8, z + 0.5, 1, 1, 2.2, PLASTIC, { rim: 0 });
  box(c, x, y, z + 2.4, 11, 1.1, 7.6, '#1b1d27', { rim: 0.4 });
  const glow = SCREENS[Math.floor(p.n * SCREENS.length)] as string;
  onLeft(c, y + 1.1, () => {
    const g = c.createLinearGradient(0, -(z + 10), 0, -(z + 2.4));
    g.addColorStop(0, shade(glow, 0.8));
    g.addColorStop(1, shade(glow, 0.42));
    c.fillStyle = g;
    c.fillRect(x + 0.7, -(z + 9.4), 9.6, 6.4);
    c.fillStyle = 'rgba(12,16,26,0.55)';
    for (let i = 0; i < 5; i++) c.fillRect(x + 1.6, -(z + 8.6) + i * 1.15, 2 + speck(p.tx, p.ty, i) * 6, 0.45);
  });
}

function keyboard(c: Art, x: number, y: number, z: number): void {
  box(c, x, y, z, 7.5, 2.8, 0.5, '#23252f', { rim: 0.3 });
  onLid(c, z + 0.5, () => {
    c.fillStyle = 'rgba(190,200,215,0.32)';
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) c.fillRect(x + 0.4 + i * 0.76, y + 0.4 + row * 0.72, 0.5, 0.42);
  });
}

// The old monitor nobody will throw out. It's the one on the site, and it always shows the game.
function crt(c: Art, x: number, y: number, z: number): void {
  box(c, x + 1.5, y + 1, z, 8, 7, 1, '#b9b2a2', { rim: 0.3 });
  box(c, x, y, z + 1, 11, 8.5, 9.4, '#cfc7b4', { rim: 0.6, fall: 0.25 });
  onLeft(c, y + 8.5, () => {
    c.fillStyle = '#1b1d27';
    c.fillRect(x + 0.8, -(z + 9.8), 9.4, 7.4);
    c.fillStyle = '#2a7d62';
    c.fillRect(x + 1.4, -(z + 9.2), 8.2, 6.2);
    c.fillStyle = '#ffd27a';
    c.fillRect(x + 3, -(z + 8.2), 5, 0.9);
    c.fillStyle = '#f7f1e4';
    c.fillRect(x + 4.4, -(z + 6.8), 2.2, 2.6);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 6; i++) c.fillRect(x + 1.4, -(z + 9.2) + i * 1.1, 8.2, 0.3);
  });
}

function chair(c: Art, x: number, y: number): void {
  box(c, x + 4.4, y + 10.4, 5.2, 7, 4, 1.2, '#30364a', { rim: 0.2 });
  box(c, x + 4.6, y + 14, 6.6, 6.6, 1.1, 8.2, '#3a4158', { rim: 0.4 });
}

function drawDesk(c: Art, p: Place): void {
  const { x, y, n } = p;
  const eastDesk = p.at(1, 0) === 'D';
  const westDesk = p.at(-1, 0) === 'D';
  const LID = 10;
  box(c, x + (westDesk ? 0 : 1), y + 2, 1, TILE - (westDesk ? 0 : 1) - (eastDesk ? 0 : 1), 1.4, LID - 1, '#3a3f4e', { noRight: eastDesk });
  box(c, x + (westDesk ? 0 : 1), y + 3.4, 7.2, TILE - (westDesk ? 0 : 1) - (eastDesk ? 0 : 1), 1.6, 1.4, '#20232c', { noRight: eastDesk, rim: 0 });
  c.strokeStyle = 'rgba(190,200,215,0.3)';
  c.lineWidth = 0.3;
  const cable = worldToScreen(x + 2, y + 5, 7.6);
  c.beginPath();
  c.moveTo(cable.x, cable.y);
  c.quadraticCurveTo(cable.x + 3, cable.y + 5, cable.x + 2, cable.y + 8);
  c.stroke();
  if (!westDesk) box(c, x + 0.8, y + 12.5, 0, 1.2, 1.2, LID, STEEL_DARK, { rim: 0 });
  if (!eastDesk) {
    box(c, x + 14, y + 12.5, 0, 1.2, 1.2, LID, STEEL_DARK, { rim: 0 });
    box(c, x + 6.5, y + 3.5, 0.6, 7.5, 10, LID - 0.6, STEEL_DARK);
    onRight(c, x + 14, () => {
      c.fillStyle = 'rgba(10,12,18,0.45)';
      for (const z of [3.2, 6.4]) c.fillRect(y + 3.6, -z, 9.8, 0.4);
      c.fillStyle = STEEL;
      for (const z of [1.6, 4.8, 8]) c.fillRect(y + 7, -z, 3, 0.6);
    });
  }
  const wood = tones(WOOD);
  box(c, x, y + 1, LID, TILE, 14, 1.2, wood, { noRight: eastDesk, rim: 0.7 });
  const Z = LID + 1.2;
  onLid(c, Z, () => {
    c.strokeStyle = 'rgba(40,22,10,0.14)';
    c.lineWidth = 0.3;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(x, y + 2 + i * 2.2 + speck(p.tx, i, 2));
      c.lineTo(x + TILE, y + 2 + i * 2.2 + speck(p.ty, i, 3));
      c.stroke();
    }
  });
  if (n > 0.9) crt(c, x + 2.5, y + 1.6, Z);
  else monitor(c, p, x + 2.5, y + 2.2, Z);
  keyboard(c, x + 3.6, y + 10, Z);
  box(c, x + 12, y + 9.4, Z, 1.5, 2.2, 0.6, '#2d303b', { rim: 0.2 });
  if (hasLamp(p.tx, p.ty)) lamp(c, x + 12.6, y + 3, Z);
  else if (n > 0.42) papers(c, x + 11.6, y + 2.8, Z, 3.4, 4.4, 2 + Math.floor(n * 6));
  if (n < 0.45) mug(c, x + 1, y + 10.4, Z, n < 0.22 ? '#d9402f' : '#f5edd8');
  else if (n > 0.86) papers(c, x + 0.6, y + 11, Z, 2.8, 3, 2);
  if (NOTES.some((note) => note.tx === p.tx && note.ty === p.ty)) {
    onLid(c, Z + 0.1, () => {
      c.fillStyle = '#ffd84a';
      c.fillRect(x + 0.8, y + 6, 3.6, 3.6);
    });
  }
  chair(c, x, y);
}

function drawTable(c: Art, p: Place): void {
  const { x, y } = p;
  const room = roomAt(p.tx, p.ty);
  const LID = 9.5;
  const east = p.at(1, 0) === 'T';
  const south = p.at(0, 1) === 'T';
  const west = p.at(-1, 0) === 'T';
  const north = p.at(0, -1) === 'T';
  const wood = room === 'break' ? '#d9d2c2' : room === 'meeting' ? '#7c4f33' : '#9c7350';
  if (!east && !south) box(c, x + 12, y + 12, 0, 2.4, 2.4, LID, STEEL_DARK, { rim: 0 });
  if (!west && !south) box(c, x + 1.6, y + 12, 0, 2.4, 2.4, LID, STEEL_DARK, { rim: 0 });
  if (!east && !north) box(c, x + 12, y + 1.6, 0, 2.4, 2.4, LID, STEEL_DARK, { rim: 0 });
  box(c, x + (west ? 0 : 0.6), y + (north ? 0 : 0.6), LID, TILE - (west ? 0 : 0.6) - (east ? 0 : 0.6), TILE - (north ? 0 : 0.6) - (south ? 0 : 0.6), 1.3, wood,
    { noRight: east, noLeft: south, rim: 0.65 });
  const Z = LID + 1.3;
  const r = speck(p.tx, p.ty, 4);
  if (room === 'open' && p.tx === 19 && p.ty === 13) {
    crt(c, x + 2, y + 3, Z);
    return;
  }
  if (room === 'meeting') {
    if (!south) box(c, x + 4.6, y + 14.6, 4, 6.6, 1.1, 11, '#34506a', { rim: 0.4 });
    if (!east) box(c, x + 14.6, y + 4.6, 4, 1.1, 6.6, 11, '#2c455c', { rim: 0.4 });
    if (r > 0.45) {
      box(c, x + 3, y + 3, Z, 8, 5.6, 0.4, '#2a2d38', { rim: 0.3 });
      box(c, x + 3, y + 2.6, Z + 0.4, 8, 0.5, 5, '#20222c', { rim: 0.2 });
      onLeft(c, y + 3.1, () => {
        c.fillStyle = shade(GLOW.screen, 0.6);
        c.fillRect(x + 3.5, -(Z + 5), 7, 4.2);
      });
    } else papers(c, x + 4, y + 5, Z, 5, 6.5, 3);
  } else if (room === 'break') {
    mug(c, x + 3 + r * 6, y + 4 + r * 3, Z, '#f5edd8');
    if (r > 0.5) box(c, x + 7, y + 8, Z, 5, 4, 0.7, '#b34a3a', { rim: 0.2 });
  } else {
    if (r > 0.3) papers(c, x + 2 + r * 6, y + 2 + r * 5, Z, 5.2, 6.6, 2 + Math.floor(r * 5));
    if (r < 0.5) mug(c, x + 9, y + 10, Z, '#f5edd8');
  }
}

function leaf(c: Art, x: number, y: number, angle: number, length: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(length * 0.5, -length * 0.3, length, 0);
  c.quadraticCurveTo(length * 0.5, length * 0.3, 0, 0);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = 'rgba(190,240,190,0.2)';
  c.lineWidth = 0.25;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(length * 0.9, 0);
  c.stroke();
  c.restore();
}

function drawPlant(c: Art, p: Place): void {
  const { x, y } = p;
  box(c, x + 4.4, y + 4.4, 0, 7.2, 7.2, 6.4, '#c1633d', { fall: 0.45, rim: 0.4 });
  box(c, x + 3.9, y + 3.9, 6.4, 8.2, 8.2, 1.1, '#d27a50', { rim: 0.5 });
  box(c, x + 4.8, y + 4.8, 7.5, 6.4, 6.4, 0.2, '#2c2118', { rim: 0, noLeft: true, noRight: true });
  const base = worldToScreen(x + 8, y + 8, 7.6);
  const leaves = 26;
  for (let i = 0; i < leaves; i++) {
    const t = i / leaves;
    const a = -Math.PI / 2 + (speck(p.tx, p.ty, i) - 0.5) * (3.5 - t * 1.6);
    const length = 12 + speck(p.ty, i, p.tx) * 9;
    const g = 0.75 + t * 0.55;
    leaf(c, base.x + (speck(i, p.tx, 1) - 0.5) * 3, base.y - t * 4, a, length, shade(night('#3f9a68'), g + speck(i, 2, p.ty) * 0.2));
  }
}

function runsAlong(p: Place): boolean {
  return p.at(1, 0) === 'S' || p.at(-1, 0) === 'S';
}

function drawPartition(c: Art, p: Place): void {
  const { x, y } = p;
  const H = 17;
  const THICK = 6;
  const fabric = tones('#55607a');
  const cap = '#aeb7c4';
  const alongX = runsAlong(p);
  const alongY = p.at(0, 1) === 'S' || p.at(0, -1) === 'S';
  if (alongY) {
    const from = p.at(0, -1) === 'S' ? 0 : 5;
    const to = p.at(0, 1) === 'S' ? TILE : 11;
    box(c, x + 5, y + from, 0, THICK, to - from, H, fabric, { noLeft: p.at(0, 1) === 'S' });
    box(c, x + 4.6, y + from, H, THICK + 0.8, to - from, 1, cap, { noLeft: p.at(0, 1) === 'S', rim: 0.5 });
  }
  if (alongX || !alongY) {
    const from = p.at(-1, 0) === 'S' ? 0 : 5;
    const to = p.at(1, 0) === 'S' ? TILE : 11;
    box(c, x + from, y + 5, 0, to - from, THICK, H, fabric, { noRight: p.at(1, 0) === 'S' });
    box(c, x + from, y + 4.6, H, to - from, THICK + 0.8, 1, cap, { noRight: p.at(1, 0) === 'S', rim: 0.5 });
    if (speck(p.tx, p.ty, 9) > 0.55) {
      onLeft(c, y + 11, () => {
        c.fillStyle = speck(p.tx, p.ty, 5) > 0.5 ? night('#ffd84a') : night('#f5edd8');
        c.fillRect(x + 4 + speck(p.tx, 1, 2) * 6, -13, 3.6, 3.6);
      });
    }
  }
}

function openSide(p: Place): 'left' | 'right' {
  return p.at(0, 1) === '#' || p.at(0, 1) === 'P' || p.at(1, 0) === '.' ? 'right' : 'left';
}

function drawCabinet(c: Art, p: Place): void {
  const { x, y } = p;
  const H = 25;
  const steel = tones(STEEL);
  box(c, x + 1.5, y + 2, 0, 13, 12, H, steel, { fall: 0.2, rim: 0.7 });
  const onFace = (draw: (along: number) => void): void => {
    if (openSide(p) === 'left') onLeft(c, y + 14, () => draw(x + 1.5));
    else onRight(c, x + 14.5, () => draw(y + 2));
  };
  onFace((along) => {
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 26; i++) c.fillRect(along + 0.2, -H + i * 0.96, 12.6, 0.2);
    for (let drawer = 0; drawer < 3; drawer++) {
      const z = H - 1 - drawer * 8;
      c.fillStyle = 'rgba(8,10,16,0.5)';
      c.fillRect(along + 0.6, -z + 7.4, 11.6, 0.5);
      c.fillStyle = night('#f5edd8');
      c.fillRect(along + 4, -z + 1, 5, 2);
      c.fillStyle = '#1c1a26';
      c.fillRect(along + 4.6, -z + 1.6, 3.4, 0.3);
      c.fillStyle = shade(night(STEEL), 1.35);
      c.fillRect(along + 4.4, -z + 4.2, 4.2, 0.9);
    }
  });
  const room = roomAt(p.tx, p.ty);
  if (room === 'print') {
    box(c, x + 3, y + 3.6, H, 10, 7.6, 4.4, '#a97a50', { rim: 0.4 });
    box(c, x + 3, y + 7, H, 10, 0.8, 4.5, '#e9dcc0', { rim: 0, noLeft: true, noRight: true });
  } else if (room === 'boss') {
    box(c, x + 5.4, y + 6, H, 5, 4, 1, '#3a2a1c', { rim: 0.3 });
    box(c, x + 7, y + 7.2, H + 1, 1.8, 1.6, 2.6, '#e8c04a', { rim: 0.6 });
    box(c, x + 5.6, y + 6.4, H + 3.6, 5, 3.4, 2.8, '#ffd84a', { rim: 0.8 });
  }
}

function drawPrinter(c: Art, p: Place): void {
  const { x, y } = p;
  box(c, x + 1, y + 1.5, 0, 14, 13, 9, '#d8d3c6', { fall: 0.4, rim: 0.6 });
  onLeft(c, y + 14.5, () => {
    c.fillStyle = 'rgba(10,12,18,0.4)';
    c.fillRect(x + 2, -6, 12, 0.4);
    c.fillRect(x + 2, -3, 12, 0.4);
    c.fillStyle = night('#8c8778');
    c.fillRect(x + 6, -5, 4, 0.8);
    c.fillRect(x + 6, -2, 4, 0.8);
  });
  box(c, x + 1.6, y + 2, 9, 12.8, 11.8, 2.6, '#bdb8aa', { rim: 0.5 });
  box(c, x + 3, y + 3, 11.6, 10, 9.8, 1, '#e6e1d4', { rim: 0.6 });
  papers(c, x + 4.4, y + 7.6, 12.6, 6.6, 4.4, 2);
  box(c, x + 11.2, y + 3.4, 11.6, 1.8, 2.8, 0.5, '#2b2e38', { rim: 0.2 });
  onRight(c, x + 15, () => {
    c.fillStyle = GLOW.green;
    c.fillRect(y + 3, -8, 1, 1);
    c.fillStyle = '#1b1d27';
    c.fillRect(y + 5, -8.4, 5, 1.8);
  });
}

function drawCoffee(c: Art, p: Place): void {
  const { x, y } = p;
  box(c, x + 0.6, y + 0.8, 0, 14.8, 14.2, 8.6, '#6e5a4a', { rim: 0.4 });
  box(c, x + 0.2, y + 0.4, 8.6, 15.6, 15, 0.9, '#d6d0c2', { rim: 0.7 });
  const Z = 9.5;
  box(c, x + 3, y + 2.4, Z, 10, 8.4, 13.5, '#3b3742', { rim: 0.6, fall: 0.2 });
  box(c, x + 3, y + 2.4, Z + 13.5, 10, 8.4, 1.4, STEEL, { rim: 0.7 });
  onLeft(c, y + 10.8, () => {
    c.fillStyle = '#b3382a';
    c.fillRect(x + 4, -(Z + 13), 8, 3);
    c.fillStyle = '#ffd27a';
    c.fillRect(x + 5, -(Z + 12), 2.6, 1);
    c.fillStyle = '#100e16';
    c.fillRect(x + 5, -(Z + 9), 6, 7.4);
    c.fillStyle = 'rgba(160,200,230,0.28)';
    c.fillRect(x + 6, -(Z + 5.4), 4, 3.6);
    c.fillStyle = '#6b3a20';
    c.fillRect(x + 6, -(Z + 3.4), 4, 1.6);
  });
  mug(c, x + 11.4, y + 11.8, Z, '#f5edd8');
  if (roomAt(p.tx, p.ty) === 'break') {
    box(c, x + 0.8, y + 11, Z, 5.6, 3.8, 1.2, '#b34a3a', { rim: 0.3 });
    for (let i = 0; i < 3; i++) box(c, x + 1.4 + i * 1.6, y + 11.8, Z + 1.2, 1.3, 1.3, 1.3, '#e8a23a', { rim: 0.3 });
  } else mug(c, x + 1, y + 12, Z, '#f5edd8');
}

function drawWhiteboard(c: Art, p: Place): void {
  const { x, y } = p;
  box(c, x + 0.4, y + 0.5, 0, 15.2, 4.5, 6, '#59626f', { rim: 0.4 });
  box(c, x, y + 0.4, 9, TILE, 1.4, 30, '#c7ccd4', { noRight: p.at(1, 0) === 'w', rim: 0.6, fall: 0.1 });
  onLeft(c, y + 1.8, () => {
    c.fillStyle = '#e9eef2';
    c.fillRect(x + (p.at(-1, 0) === 'w' ? 0 : 0.8), -38, TILE - (p.at(1, 0) === 'w' ? 0 : 0.8) - (p.at(-1, 0) === 'w' ? 0 : 0.8), 28);
    c.strokeStyle = '#6a4bb5';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const z = 34 - i * 4;
      c.moveTo(x + 2, -z - speck(p.tx, i, 1) * 3 + 2);
      c.lineTo(x + 3 + speck(p.tx, i, 2) * 10, -z);
    }
    c.stroke();
    c.strokeStyle = '#d9402f';
    c.beginPath();
    c.moveTo(x + 2, -13);
    c.lineTo(x + 6, -18);
    c.lineTo(x + 9, -15);
    c.lineTo(x + 14, -24);
    c.stroke();
  });
  box(c, x + 1, y + 1.8, 9, 14, 1.4, 0.7, STEEL_DARK, { rim: 0.3 });
  box(c, x + 4, y + 2, 9.7, 2.6, 0.6, 0.6, '#d9402f', { rim: 0 });
}

function drawBossDesk(c: Art, p: Place): void {
  const { x, y } = p;
  const east = p.at(1, 0) === 'B';
  const south = p.at(0, 1) === 'B';
  const LID = 11;
  const dark = '#5e3120';
  box(c, x + (p.at(-1, 0) === 'B' ? 0 : 1.4), y + (p.at(0, -1) === 'B' ? 0 : 1.4), 0.5, TILE - (east ? 0 : 1.4) - (p.at(-1, 0) === 'B' ? 0 : 1.4),
    TILE - (south ? 0 : 1.4) - (p.at(0, -1) === 'B' ? 0 : 1.4), LID - 0.5, dark, { noRight: east, noLeft: south, rim: 0.2 });
  box(c, x, y, LID, TILE, TILE, 1.5, '#8a5233', { noRight: east, noLeft: south, rim: 0.7 });
  const Z = LID + 1.5;
  if (!east && !south) {
    onLid(c, Z, () => {
      c.fillStyle = '#7a2f26';
      c.fillRect(x - 10, y - 8, 16, 10);
      c.strokeStyle = 'rgba(240,210,150,0.4)';
      c.lineWidth = 0.4;
      c.strokeRect(x - 9.4, y - 7.4, 14.8, 8.8);
    });
    papers(c, x - 7, y - 5, Z, 7, 5, 3);
    mug(c, x + 8, y + 9, Z, '#f5edd8');
    box(c, x - 8, y + 12, Z, 16, 2.4, 3.4, '#d9b24a', { rim: 0.7 });
    onLeft(c, y + 14.4, () => drawText(c, 'BOSS', x - textWidth('BOSS', 0.4) / 2, -(Z + 2.9), '#2a1a10', 0.4));
    box(c, x + 2, y - 6, Z, 5, 4, 0.8, '#b3382a', { rim: 0.3 });
    box(c, x + 3.4, y - 5, Z + 0.8, 2.2, 2, 3.2, '#23252f', { rim: 0.4 });
  }
  if (east && !south) lamp(c, x + 2, y + 2, Z);
  if (east && south) monitor(c, p, x + 1, y + 2, Z);
}

function drawWall(c: Art, p: Place): void {
  const { x, y, tx, ty } = p;
  const back = tx === 0 || ty === 0;
  if (back) return;
  const south = p.at(0, 1) === '#';
  const east = p.at(1, 0) === '#';
  // The two front edges stay open: a glass rail on the rim of the slab, and the floor runs up to it.
  if (tx === 39 || ty === 27) {
    const onY = ty === 27;
    const [gx, gy, gw, gd] = onY ? [x, y + 13.5, TILE, 1.4] : [x + 13.5, y, 1.4, TILE];
    box(c, gx as number, gy as number, 0, gw as number, gd as number, 1.2, '#59626f', { noRight: onY, noLeft: !onY, rim: 0.2 });
    c.fillStyle = 'rgba(150,190,235,0.1)';
    if (onY) poly(c, [x, y + 14.2, 9], [x + TILE, y + 14.2, 9], [x + TILE, y + 14.2, 1], [x, y + 14.2, 1]);
    else poly(c, [x + 14.2, y, 9], [x + 14.2, y + TILE, 9], [x + 14.2, y + TILE, 1], [x + 14.2, y, 1]);
    c.fill();
    box(c, gx as number, gy as number, 9, gw as number, gd as number, 0.8, '#c6ccd6', { noRight: onY, noLeft: !onY, rim: 0.6 });
    return;
  }
  const H = 13;
  box(c, x, y, 0, TILE, TILE, H, tones('#e8dcc2'), { noLeft: south, noRight: east, fall: 0.5, rim: 0 });
  if (!south) box(c, x, y + 15.6, 0, TILE, 0.5, 1.6, '#3a3f4e', { noRight: east, rim: 0, fall: 0 });
  if (!east) box(c, x + 15.6, y, 0, 0.5, TILE, 1.6, '#3a3f4e', { noLeft: south, rim: 0, fall: 0 });
  const cut = mix('#1a1824', '#3a3550', 0.5);
  poly(c, [x, y, H], [x + TILE, y, H], [x + TILE, y + TILE, H], [x, y + TILE, H]);
  c.fillStyle = cut;
  c.fill();
  onLid(c, H, () => {
    c.strokeStyle = alpha('#ffe9c8', 0.34);
    c.lineWidth = 0.5;
    c.beginPath();
    if (!south) { c.moveTo(x, y + TILE); c.lineTo(x + TILE, y + TILE); }
    if (!east) { c.moveTo(x + TILE, y); c.lineTo(x + TILE, y + TILE); }
    c.stroke();
  });
}

const FLOOR: TileArt = { height: 0, foot: 0, spread: 0 };

export const ART: Record<string, TileArt> = {
  '.': FLOOR,
  ',': FLOOR,
  p: FLOOR,
  b: FLOOR,
  '#': { height: 13, foot: 1, spread: 18, draw: drawWall },
  D: { height: 24, foot: 1, spread: 18, draw: drawDesk },
  T: { height: 13, foot: 1, spread: 18, draw: drawTable },
  P: { height: 34, foot: 0.7, spread: 30, draw: drawPlant },
  S: { height: 18, foot: 0.7, spread: 18, draw: drawPartition },
  F: { height: 25, foot: 0.9, spread: 18, draw: drawCabinet },
  M: { height: 15, foot: 0.9, spread: 18, draw: drawPrinter },
  C: { height: 25, foot: 1, spread: 18, draw: drawCoffee },
  w: { height: 39, foot: 1, spread: 18, draw: drawWhiteboard },
  B: { height: 26, foot: 1, spread: 30, draw: drawBossDesk },
};
