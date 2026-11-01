import { BOSS_SIGHT_HALF_ANGLE, BOSS_SIGHT_RANGE, TILE, WORK_RADIUS } from '../core/constants';
import type { Boss, Coffee, Meeting, Powerup, Printer, Task, World } from '../core/types';
import { charAt, COLS, hasLineOfSight, ROWS, tileCenter, type Office } from '../levels/office';
import { isExhausted } from '../player/player';
import { drawBossFigure, drawInvite, drawRobot, type Pose } from './actors';
import { alpha } from './box';
import type { Effects } from './effects';
import { depthOf, tileDepth, tileHides, viewFor, worldToScreen, WORLD_H, WORLD_W, type Spot, type View4 } from './iso';
import { drawJam, itemArt, type ItemKind } from './items';
import { HIGHLIGHT, INK, MINT, SKY, STAMP, VIOLET } from './palette';
import { ART } from './props';
import { canvasOf, speck } from './rooms';
import { bakeScene, PANES, placeAt, WALL_H, type Scene } from './scene';

export interface Camera {
  // The iso point at the middle of the view.
  x: number;
  y: number;
  // Eased player motion, which is what the camera leads with.
  leadX: number;
  leadY: number;
  lastX: number;
  lastY: number;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  // In HUD pixels, which is what the bitmap font and the screens are laid out in.
  width: number;
  height: number;
  // Canvas pixels per HUD pixel, and per world pixel.
  unit: number;
  zoom: number;
  canvasW: number;
  canvasH: number;
  // 0 everything, 1 no lights that cost a frame, 2 lower resolution as well.
  quality: number;
  scene: Scene | null;
  office: Office;
  sprites: Map<string, Sprite>;
  faces: { player: View4; boss: View4 };
  // Where the player was last frame, which is how the robot knows which way it's facing.
  seen: Spot;
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
}

export const newCamera = (): Camera => ({ x: 0, y: 0, leadX: 0, leadY: 0, lastX: 0, lastY: 0 });

const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v));

// Follows the player and looks ahead, more so across a narrow screen, where danger arrives fastest.
export function followCamera(view: View, camera: Camera, x: number, y: number, snap = false): void {
  const at = worldToScreen(x, y, 12);
  const wide = view.canvasW / view.zoom;
  const tall = view.canvasH / view.zoom;
  const dx = at.x - camera.lastX;
  const dy = at.y - camera.lastY;
  camera.lastX = at.x;
  camera.lastY = at.y;
  if (snap) {
    camera.leadX = 0;
    camera.leadY = 0;
  } else if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
    camera.leadX += (clamp(dx * 26, -wide * 0.2, wide * 0.2) - camera.leadX) * 0.05;
    camera.leadY += (clamp(dy * 26, -tall * 0.16, tall * 0.16) - camera.leadY) * 0.05;
  }
  // A tall phone sees the whole height of the map, so it follows with some give instead of sitting still.
  const fit = (target: number, size: number, low: number, high: number): number => {
    const mid = (low + high) / 2;
    const room = Math.max(size * 0.14, (high - low - size) / 2);
    return clamp(target, mid - room, mid + room);
  };
  const tx = fit(at.x + camera.leadX, wide, -WORLD_H - 30, WORLD_W + 30);
  const ty = fit(at.y + camera.leadY, tall, -WALL_H - 30, (WORLD_W + WORLD_H) / 2 + 50);
  const ease = snap ? 1 : 0.14;
  camera.x += (tx - camera.x) * ease;
  camera.y += (ty - camera.y) * ease;
}

// The title drifts slowly over the floor, so the office is the first thing you see.
export function tourCamera(camera: Camera, clock: number): void {
  camera.x = 96 + Math.sin(clock * 0.09) * 240;
  camera.y = 262 + Math.cos(clock * 0.07) * 110;
}

// Sharpness only changes the building's size. Going down reuses the paint, so it can happen mid-run without a stall.
export function prepare(view: View, zoom: number): void {
  const had = view.scene;
  if (had && Math.abs(had.zoom - zoom) < 0.01) return;
  view.sprites.clear();
  if (!had || zoom > had.zoom) {
    view.scene = bakeScene(view.office, zoom);
    return;
  }
  const ratio = zoom / had.zoom;
  const [canvas, c] = canvasOf(had.canvas.width * ratio, had.canvas.height * ratio);
  c.imageSmoothingQuality = 'high';
  c.drawImage(had.canvas, 0, 0, canvas.width, canvas.height);
  view.scene = { canvas, zoom, originX: had.originX * ratio, originY: had.originY * ratio };
}

function sprite(view: View, key: string, w: number, h: number, ax: number, ay: number, paint: (c: CanvasRenderingContext2D) => void, zoom = view.zoom): Sprite {
  const known = view.sprites.get(key);
  if (known) return known;
  const [canvas, c] = canvasOf(w * zoom, h * zoom);
  c.setTransform(zoom, 0, 0, zoom, ax * zoom, ay * zoom);
  paint(c);
  const made = { canvas, ax: ax * zoom, ay: ay * zoom };
  view.sprites.set(key, made);
  return made;
}

// A world point on the canvas, in canvas pixels, and in HUD pixels.
export function toCanvas(view: View, camera: Spot, x: number, y: number, z = 0): Spot {
  const at = worldToScreen(x, y, z);
  return { x: (at.x - camera.x) * view.zoom + view.canvasW / 2, y: (at.y - camera.y) * view.zoom + view.canvasH / 2 };
}

export function toHud(view: View, camera: Spot, x: number, y: number, z = 0): Spot {
  const at = toCanvas(view, camera, x, y, z);
  return { x: at.x / view.unit, y: at.y / view.unit };
}

const stamp = (ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number): void => {
  ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - s.ay));
};

const softDot = (view: View, key: string, color: string, rx: number, ry: number, strength: number): Sprite =>
  sprite(view, key, rx * 2, ry * 2, rx, ry, (c) => {
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, alpha(color, strength));
    g.addColorStop(0.55, alpha(color, strength * 0.42));
    g.addColorStop(1, alpha(color, 0));
    c.fillStyle = g;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
  });

const contact = (view: View, size: number): Sprite => softDot(view, `shadow${size}`, '#05060c', size, size * 0.52, 0.62);

function glowUnder(view: View, s: Sprite, x: number, y: number): void {
  if (view.quality > 0) return;
  view.ctx.globalCompositeOperation = 'lighter';
  stamp(view.ctx, s, x, y);
  view.ctx.globalCompositeOperation = 'source-over';
}

// What's in the world this frame, in painter's order. No drawing here, so tests can read it.
export type Thing = { depth: number; x: number; y: number } & (
  | { kind: 'player' | 'boss' }
  | { kind: 'meeting'; meeting: Meeting }
  | { kind: 'task'; task: Task }
  | { kind: 'coffee'; cup: Coffee }
  | { kind: 'power'; item: Powerup }
  | { kind: 'jam'; printer: Printer }
  | { kind: 'tile'; tx: number; ty: number; see: boolean }
);

const placed = (x: number, y: number): { depth: number; x: number; y: number } => ({ depth: depthOf(x, y), x, y });

export function thingsIn(world: World): Thing[] {
  const list: Thing[] = [];
  for (const cup of world.coffees) list.push({ kind: 'coffee', cup, ...placed(cup.x, cup.y) });
  for (const task of world.tasks) list.push({ kind: 'task', task, ...placed(task.x, task.y) });
  for (const item of world.powerups) list.push({ kind: 'power', item, ...placed(item.x, item.y) });
  for (const printer of world.printers) {
    if (printer.jamT <= 0) continue;
    const at = tileCenter(printer.blockX, printer.blockY);
    list.push({ kind: 'jam', printer, ...placed(at.x, at.y) });
  }
  for (const meeting of world.meetings) list.push({ kind: 'meeting', meeting, ...placed(meeting.x, meeting.y) });
  list.push({ kind: 'boss', ...placed(world.boss.x, world.boss.y) });
  list.push({ kind: 'player', ...placed(world.player.x, world.player.y) });
  return list;
}

// How far a thing reaches up the screen from its feet, in world pixels.
const REACH: Record<Thing['kind'], number> = { player: 34, boss: 38, meeting: 28, task: 26, coffee: 22, power: 24, jam: 14, tile: 0 };

const solidHeight = (office: Office, tx: number, ty: number): number =>
  (tx === 0 || ty === 0 ? 0 : (ART[charAt(office.tiles, tx, ty)]?.height ?? 0));

// Adds every solid tile that stands in front of a thing and covers part of it, then puts it all in order.
export function drawOrder(world: World, office: Office): Thing[] {
  const things = thingsIn(world);
  const tiles = new Map<number, Thing & { kind: 'tile' }>();
  for (const thing of things) {
    // Anything you need to find or avoid shows through the furniture. A floor item sits behind a row of monitors.
    const matters = thing.kind !== 'jam';
    const near = worldToScreen(thing.x, thing.y);
    const gx = Math.floor(thing.x / TILE);
    const gy = Math.floor(thing.y / TILE);
    for (let ty = Math.max(0, gy - 1); ty <= Math.min(ROWS - 1, gy + 4); ty++) {
      for (let tx = Math.max(0, gx - 1); tx <= Math.min(COLS - 1, gx + 4); tx++) {
        const height = solidHeight(office, tx, ty);
        if (height === 0 || !tileHides(tx, ty, thing.x, thing.y)) continue;
        const far = worldToScreen(tx * TILE + 8, ty * TILE + 8);
        if (Math.abs(near.x - far.x) > 26) continue;
        if (far.y - height - 8 > near.y + 2 || far.y + 10 < near.y - REACH[thing.kind]) continue;
        const see = matters && height >= 15;
        const known = tiles.get(ty * COLS + tx);
        if (known) known.see ||= see;
        else tiles.set(ty * COLS + tx, { kind: 'tile', depth: tileDepth(tx, ty), x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, see });
      }
    }
  }
  return [...things, ...tiles.values()].sort((a, b) => a.depth - b.depth);
}

// A piece of the finished scene, cut out along the shape of one tile's furniture, so it matches to the pixel.
function tileSprite(view: View, tx: number, ty: number): Sprite | null {
  const scene = view.scene;
  const art = ART[charAt(view.office.tiles, tx, ty)];
  if (!scene || !art?.draw) return null;
  const at = worldToScreen(tx * TILE, ty * TILE);
  const ax = art.spread;
  const ay = art.height + 3;
  return sprite(view, `t${tx},${ty}`, art.spread * 2, art.height + 30, ax, ay, (c) => {
    const zoom = view.zoom;
    c.translate(-at.x, -at.y);
    art.draw?.(c, placeAt(view.office, tx, ty));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-in';
    const { width, height } = c.canvas;
    c.drawImage(scene.canvas, Math.round(scene.originX + (at.x - ax) * zoom), Math.round(scene.originY + (at.y - ay) * zoom), width, height, 0, 0, width, height);
  });
}

function drawTile(view: View, camera: Spot, tx: number, ty: number, see: boolean): void {
  const s = tileSprite(view, tx, ty);
  if (!s) return;
  const at = toCanvas(view, camera, tx * TILE, ty * TILE);
  if (see) view.ctx.globalAlpha = 0.34;
  stamp(view.ctx, s, at.x, at.y);
  view.ctx.globalAlpha = 1;
}

function bossCone(view: View, camera: Spot, boss: Boss, office: Office): void {
  if (boss.state === 'waiting' || boss.state === 'cooldown') return;
  const hunting = boss.state === 'chase' || boss.state === 'alert';
  const { ctx } = view;
  ctx.fillStyle = hunting ? 'rgba(232,64,47,0.34)' : 'rgba(255,216,74,0.2)';
  ctx.strokeStyle = hunting ? 'rgba(255,120,100,0.7)' : 'rgba(255,226,130,0.45)';
  ctx.lineWidth = Math.max(1, view.zoom * 0.5);
  ctx.beginPath();
  const start = toCanvas(view, camera, boss.x, boss.y);
  ctx.moveTo(start.x, start.y);
  const rays = 18;
  for (let i = 0; i <= rays; i++) {
    const angle = boss.angle - BOSS_SIGHT_HALF_ANGLE + (i / rays) * BOSS_SIGHT_HALF_ANGLE * 2;
    const ray = (reach: number): Spot => ({ x: boss.x + Math.cos(angle) * reach, y: boss.y + Math.sin(angle) * reach });
    let reach = BOSS_SIGHT_RANGE;
    if (!hasLineOfSight(office, boss.x, boss.y, ray(reach).x, ray(reach).y)) {
      let lo = 0;
      let hi = reach;
      for (let k = 0; k < 5; k++) {
        const mid = (lo + hi) / 2;
        if (hasLineOfSight(office, boss.x, boss.y, ray(mid).x, ray(mid).y)) lo = mid;
        else hi = mid;
      }
      reach = lo;
    }
    const p = toCanvas(view, camera, ray(reach).x, ray(reach).y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (view.quality > 0) return;
  // Furniture standing in the cone goes back on top, so the cone stays flat on the floor. Only what it touches.
  const gx = Math.floor(boss.x / TILE);
  const gy = Math.floor(boss.y / TILE);
  const span = Math.ceil(BOSS_SIGHT_RANGE / TILE);
  for (let sum = gx + gy - span; sum <= gx + gy + span; sum++) {
    for (let tx = Math.max(1, gx - span); tx <= Math.min(COLS - 1, gx + span); tx++) {
      const ty = sum - tx;
      if (ty < 1 || ty >= ROWS || Math.abs(ty - gy) > span) continue;
      if (solidHeight(office, tx, ty) === 0 || charAt(office.tiles, tx, ty) === '#') continue;
      const dx = tx * TILE + 8 - boss.x;
      const dy = ty * TILE + 8 - boss.y;
      if (Math.hypot(dx, dy) > BOSS_SIGHT_RANGE + 8) continue;
      const turn = Math.abs(((Math.atan2(dy, dx) - boss.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (turn < BOSS_SIGHT_HALF_ANGLE + 0.3) drawTile(view, camera, tx, ty, false);
    }
  }
}

function drawItem(view: View, camera: Spot, kind: ItemKind, x: number, y: number, bob: number, faint: boolean): void {
  const { ctx } = view;
  const art = itemArt(kind);
  const at = toCanvas(view, camera, x, y);
  glowUnder(view, softDot(view, `glow${art.glow}`, art.glow, 24, 15, 0.5), at.x, at.y);
  stamp(ctx, contact(view, 7), at.x, at.y);
  if (faint) ctx.globalAlpha = 0.35;
  stamp(ctx, sprite(view, `item${kind}`, 34, 46, 17, 38, art.draw), at.x, at.y - bob * view.zoom);
  ctx.globalAlpha = 1;
}

function drawTaskMarks(view: View, camera: Spot, task: Task): void {
  const { ctx, zoom: z } = view;
  const at = toCanvas(view, camera, task.x, task.y);
  const bar = 18 * z;
  const y = at.y - 33 * z;
  ctx.fillStyle = INK;
  ctx.fillRect(Math.round(at.x - bar / 2), Math.round(y), Math.round(bar), Math.round(2.8 * z));
  ctx.fillStyle = task.life < 3.5 ? STAMP : MINT;
  ctx.fillRect(Math.round(at.x - bar / 2 + z * 0.6), Math.round(y + z * 0.6), Math.round((bar - z * 1.2) * (task.life / task.maxLife)), Math.round(1.6 * z));
  const ring = (color: string, width: number, turn: number): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, z * width);
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, WORK_RADIUS * z * 1.05, WORK_RADIUS * z * 0.53, 0, -Math.PI / 2, -Math.PI / 2 + turn * Math.PI * 2);
    ctx.stroke();
  };
  ring('rgba(255,216,74,0.34)', 0.9, 1);
  if (task.work > 0) ring(HIGHLIGHT, 1.6, task.work / task.need);
}

const STRIDES = 8;
const frameKey = (who: string, pose: Pose): string =>
  `${who}${pose.view}${pose.stride < 0 ? -1 : Math.floor(pose.stride * STRIDES)}${pose.dash ? 'd' : ''}${pose.tired ? 't' : ''}${pose.stunned ? 's' : ''}`;

function actorFrame(view: View, who: 'robot' | 'boss', pose: Pose): Sprite {
  const stride = pose.stride < 0 ? -1 : Math.floor(pose.stride * STRIDES) / STRIDES;
  return sprite(view, frameKey(who, pose), 46, 56, 23, 48, (c) => (who === 'robot' ? drawRobot : drawBossFigure)(c, { ...pose, stride }));
}

// The same frame as a line around the figure, for a character behind something tall.
function outlineOf(view: View, frame: Sprite, key: string, color: string): Sprite {
  const known = view.sprites.get(key);
  if (known) return known;
  const pad = 2;
  const [canvas, c] = canvasOf(frame.canvas.width + pad * 2, frame.canvas.height + pad * 2);
  for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]] as const) c.drawImage(frame.canvas, pad + dx, pad + dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.globalCompositeOperation = 'destination-out';
  c.drawImage(frame.canvas, pad, pad);
  const made = { canvas, ax: frame.ax + pad, ay: frame.ay + pad };
  view.sprites.set(key, made);
  return made;
}

function playerPose(view: View, world: World): Pose {
  const p = world.player;
  const dashing = p.dashT > 0;
  const stride = p.moving || dashing ? (p.walkT * (isExhausted(p) ? 1.2 : 2.1)) % 1 : -1;
  return { view: view.faces.player, stride, dash: dashing, tired: isExhausted(p), stunned: p.stunT > 0 };
}

function bossPose(view: View, boss: Boss): Pose {
  const moving = boss.state === 'patrol' || boss.state === 'chase';
  return { view: view.faces.boss, stride: moving ? (boss.walkT * 1.7) % 1 : -1, dash: false, tired: false, stunned: false };
}

function drawPlayer(view: View, camera: Spot, world: World): void {
  const { ctx, zoom: z } = view;
  const p = world.player;
  const at = toCanvas(view, camera, p.x, p.y);
  stamp(ctx, contact(view, 10), at.x, at.y);
  if (p.iframes > 0 && Math.floor(world.time * 16) % 2 === 0) return;
  const frame = actorFrame(view, 'robot', playerPose(view, world));
  if (p.dashT > 0) {
    for (const [back, fade] of [[9, 0.34], [16, 0.16]] as const) {
      const ghost = toCanvas(view, camera, p.x - p.dashX * back, p.y - p.dashY * back);
      ctx.globalAlpha = fade;
      stamp(ctx, frame, ghost.x, ghost.y);
    }
  }
  ctx.globalAlpha = p.awayT > 0 ? 0.5 : 1;
  stamp(ctx, frame, at.x, at.y);
  ctx.globalAlpha = 1;
  const head = toCanvas(view, camera, p.x, p.y, 28);
  if (p.quietT > 0) {
    ctx.strokeStyle = MINT;
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 8 * z, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = MINT;
    ctx.fillRect(head.x - 9.4 * z, head.y - z, 3 * z, 5 * z);
    ctx.fillRect(head.x + 6.4 * z, head.y - z, 3 * z, 5 * z);
  }
  if (p.wiredT > 0 && Math.floor(world.time * 12) % 2 === 0) {
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(head.x - 11 * z, head.y - 2 * z, z, 3 * z);
    ctx.fillRect(head.x + 10 * z, head.y + z, z, 3 * z);
  }
}

function drawBoss(view: View, camera: Spot, world: World): void {
  const { ctx, zoom: z } = view;
  const { boss, time } = world;
  const at = toCanvas(view, camera, boss.x, boss.y);
  stamp(ctx, contact(view, 12), at.x, at.y);
  stamp(ctx, actorFrame(view, 'boss', bossPose(view, boss)), at.x, at.y);
  if (boss.state !== 'alert' && boss.state !== 'chase') return;
  const mark = toCanvas(view, camera, boss.x, boss.y, 41 + (Math.floor(time * 10) % 2));
  ctx.fillStyle = INK;
  ctx.fillRect(mark.x - 2.4 * z, mark.y - 9.4 * z, 4.8 * z, 12.8 * z);
  ctx.fillStyle = STAMP;
  ctx.fillRect(mark.x - 1.4 * z, mark.y - 8.4 * z, 2.8 * z, 6.8 * z);
  ctx.fillRect(mark.x - 1.4 * z, mark.y - 0.6 * z, 2.8 * z, 2.8 * z);
}

function drawMeeting(view: View, camera: Spot, m: Meeting, time: number): void {
  const { ctx } = view;
  const at = toCanvas(view, camera, m.x, m.y);
  const frozen = m.frozenT > 0;
  const frame = frozen ? 0 : Math.floor(time * 5 + m.id) % 2;
  glowUnder(view, softDot(view, `meet${frozen}`, frozen ? SKY : VIOLET, 20, 12, 0.42), at.x, at.y);
  stamp(ctx, contact(view, frozen ? 9 : 7), at.x, at.y);
  // A stapled meeting can still stun you, so its ring stays red.
  ctx.strokeStyle = frozen ? 'rgba(255,90,72,0.8)' : 'rgba(164,120,235,0.5)';
  ctx.lineWidth = Math.max(1, view.zoom * 0.8);
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, 12 * view.zoom, 6 * view.zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
  stamp(ctx, sprite(view, `invite${frame}${frozen}`, 36, 52, 18, 42, (c) => drawInvite(c, frame, frozen)), at.x, at.y);
}

function drawJamAt(view: View, camera: Spot, printer: Printer, time: number): void {
  const { ctx, zoom } = view;
  const blink = Math.floor(time * 6) % 2 === 0;
  const at = toCanvas(view, camera, printer.blockX * TILE + 8, printer.blockY * TILE + 8);
  stamp(ctx, sprite(view, `jam${blink}`, 46, 42, 23, 30, (c) => drawJam(c, blink)), at.x, at.y);
  const beacon = toCanvas(view, camera, printer.x, printer.y, 18);
  if (blink) glowUnder(view, softDot(view, 'beacon', '#ff5a48', 20, 20, 0.7), beacon.x, beacon.y);
  ctx.fillStyle = blink ? '#ff5a48' : '#6a1a14';
  ctx.beginPath();
  ctx.arc(beacon.x, beacon.y, 2.2 * zoom, 0, Math.PI * 2);
  ctx.fill();
}

function drawThing(view: View, camera: Spot, world: World, t: Thing): void {
  const { time } = world;
  const blinking = (life: number, limit: number): boolean => life < limit && Math.floor(time * 7) % 2 === 0;
  switch (t.kind) {
    case 'tile': drawTile(view, camera, t.tx, t.ty, t.see); break;
    case 'player': drawPlayer(view, camera, world); break;
    case 'boss': drawBoss(view, camera, world); break;
    case 'meeting': drawMeeting(view, camera, t.meeting, time); break;
    case 'jam': drawJamAt(view, camera, t.printer, time); break;
    case 'coffee': drawItem(view, camera, 'coffee', t.x, t.y, 0, false); break;
    case 'power': drawItem(view, camera, t.item.kind, t.x, t.y, Math.sin(time * 4) * 1.5, blinking(t.item.life, 3)); break;
    case 'task':
      drawItem(view, camera, t.task.kind, t.x, t.y, Math.sin(time * 4 + t.task.id) * 1.4, blinking(t.task.life, 3.5));
      drawTaskMarks(view, camera, t.task);
      break;
  }
}

// Only when something tall really covers the body, not when it just stands nearby.
function hidden(office: Office, order: readonly Thing[], x: number, y: number): boolean {
  const me = worldToScreen(x, y);
  return order.some((t) => {
    if (t.kind !== 'tile' || !t.see || !tileHides(t.tx, t.ty, x, y)) return false;
    const it = worldToScreen(t.x, t.y);
    return Math.abs(it.x - me.x) < 13 && it.y - solidHeight(office, t.tx, t.ty) * 0.8 < me.y - 12 && it.y + 6 > me.y - 8;
  });
}

function outlineIfHidden(view: View, camera: Spot, order: readonly Thing[], who: 'robot' | 'boss', x: number, y: number, pose: Pose, color: string): void {
  if (!hidden(view.office, order, x, y)) return;
  const at = toCanvas(view, camera, x, y);
  stamp(view.ctx, outlineOf(view, actorFrame(view, who, pose), `line${frameKey(who, pose)}`, color), at.x, at.y);
}

// Rain runs down the glass of the windows on screen, and nowhere else: the office has a roof, even if we can't see it.
function rainOnGlass(view: View, camera: Spot, time: number): void {
  const { ctx, zoom } = view;
  ctx.fillStyle = 'rgba(190,215,250,0.32)';
  for (const pane of PANES) {
    for (let i = 0; i < 6; i++) {
      const along = (pane.from + pane.length * speck(i, pane.from, 5)) * TILE;
      const z = 52 - (time * (24 + i * 5) + i * 13) % 38;
      const at = pane.wall === 'north' ? toCanvas(view, camera, along, TILE, z) : toCanvas(view, camera, TILE, along, z);
      if (at.x > -9 && at.y > -9 && at.x < view.canvasW && at.y < view.canvasH) ctx.fillRect(at.x, at.y, Math.max(1, zoom * 0.3), zoom * 3.4);
    }
  }
}

// Paints the building and everything in it, and returns the camera it really used, snapped to whole pixels.
export function paintWorld(view: View, camera: Camera, world: World, fx: Effects): Spot | null {
  const { ctx, canvasW, canvasH, zoom, scene } = view;
  if (!scene) return null;
  const shake = fx.shake * 7;
  const p = world.player;
  const { boss } = world;
  if (p.dashT > 0) view.faces.player = viewFor(p.dashX, p.dashY, view.faces.player);
  else if (p.moving) view.faces.player = viewFor(p.x - view.seen.x, p.y - view.seen.y, view.faces.player);
  view.seen = { x: p.x, y: p.y };
  view.faces.boss = viewFor(Math.cos(boss.angle), Math.sin(boss.angle), view.faces.boss);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = Math.round(scene.originX + (camera.x + (Math.random() - 0.5) * shake) * zoom - canvasW / 2);
  const sy = Math.round(scene.originY + (camera.y + (Math.random() - 0.5) * shake) * zoom - canvasH / 2);
  ctx.fillStyle = '#0a0c17';
  if (sx < 0 || sy < 0 || sx + canvasW > scene.canvas.width || sy + canvasH > scene.canvas.height) ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(scene.canvas, sx, sy, canvasW, canvasH, 0, 0, canvasW, canvasH);
  // Everything below lands on the same whole pixels, so nothing swims against the floor.
  const snapped: Spot = { x: (sx - scene.originX + canvasW / 2) / zoom, y: (sy - scene.originY + canvasH / 2) / zoom };

  if (view.quality === 0) rainOnGlass(view, snapped, world.time);
  bossCone(view, snapped, boss, view.office);
  const order = drawOrder(world, view.office);
  for (const thing of order) drawThing(view, snapped, world, thing);
  outlineIfHidden(view, snapped, order, 'robot', p.x, p.y, playerPose(view, world), HIGHLIGHT);
  outlineIfHidden(view, snapped, order, 'boss', boss.x, boss.y, bossPose(view, boss), STAMP);

  for (const bit of fx.particles) {
    const at = toCanvas(view, snapped, bit.x, bit.y, 8);
    ctx.fillStyle = bit.color;
    ctx.fillRect(Math.round(at.x), Math.round(at.y), bit.size * zoom, bit.size * zoom);
  }
  return snapped;
}

// The robot at any size, for the screens. x and y are in HUD pixels, at its feet.
export function drawHero(view: View, x: number, y: number, size: number, pose: Partial<Pose> = {}): void {
  const { ctx, unit } = view;
  const full: Pose = { view: 'sw', stride: -1, dash: false, tired: false, stunned: false, ...pose };
  const s = sprite(view, `hero${size}${frameKey('', full)}`, 46, 56, 23, 48, (c) => drawRobot(c, full), size * unit);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(s.canvas, Math.round(x * unit - s.ax), Math.round(y * unit - s.ay));
  ctx.restore();
}
