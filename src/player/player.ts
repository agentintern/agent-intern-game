import {
  COFFEE_ENERGY, DASH_COOLDOWN, DASH_COST, DASH_FACTOR, DASH_SECONDS, ENERGY_DRAIN, ENERGY_MAX,
  IFRAMES_AFTER_STUN, isLunch, MAX_STRIKES, PLAYER_RADIUS, PLAYER_SPEED, SLUGGISH_FACTOR, STEP, WIRED_FACTOR,
  WIRED_SECONDS,
} from '../core/constants';
import type { Facing, Input, Player, World } from '../core/types';
import { isSolidAt, type Office, type Point } from '../levels/office';

export function createPlayer(start: Point): Player {
  return {
    x: start.x,
    y: start.y,
    facing: 'down',
    moving: false,
    energy: ENERGY_MAX,
    wiredT: 0,
    dashT: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 1,
    stunT: 0,
    stunText: '',
    stunBy: 'meeting',
    iframes: 0,
    strikes: 0,
    walkT: 0,
    quietT: 0,
    awayT: 0,
  };
}

function blocked(office: Office, x: number, y: number): boolean {
  const r = PLAYER_RADIUS;
  return (
    isSolidAt(office, x - r, y - r) ||
    isSolidAt(office, x + r, y - r) ||
    isSolidAt(office, x - r, y + r) ||
    isSolidAt(office, x + r, y + r)
  );
}

// Each axis moves on its own, so you slide along desks instead of sticking to them.
function moveWithCollision(office: Office, player: Player, dx: number, dy: number): void {
  if (!blocked(office, player.x + dx, player.y)) player.x += dx;
  if (!blocked(office, player.x, player.y + dy)) player.y += dy;
}

function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export const isExhausted = (player: Player): boolean => player.energy <= 0;

export const isInvulnerable = (player: Player): boolean =>
  player.dashT > 0 || player.iframes > 0 || player.stunT > 0;

export function stepPlayer(world: World, input: Input): void {
  const p = world.player;
  p.wiredT = Math.max(0, p.wiredT - STEP);
  p.dashCooldown = Math.max(0, p.dashCooldown - STEP);
  p.iframes = Math.max(0, p.iframes - STEP);
  p.quietT = Math.max(0, p.quietT - STEP);
  p.awayT = Math.max(0, p.awayT - STEP);
  p.energy = Math.max(0, p.energy - ENERGY_DRAIN * (isLunch(world.time) ? 0.5 : 1) * STEP);

  if (p.stunT > 0) {
    p.stunT -= STEP;
    p.moving = false;
    if (p.stunT <= 0) p.iframes = IFRAMES_AFTER_STUN;
    return;
  }

  const len = Math.hypot(input.moveX, input.moveY);
  const nx = len > 1 ? input.moveX / len : input.moveX;
  const ny = len > 1 ? input.moveY / len : input.moveY;

  if (input.dash && p.dashCooldown <= 0 && !isExhausted(p) && p.dashT <= 0) {
    p.dashT = DASH_SECONDS;
    p.dashCooldown = DASH_COOLDOWN;
    p.energy = Math.max(0, p.energy - DASH_COST);
    const dirX = len > 0.1 ? nx : p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
    const dirY = len > 0.1 ? ny : p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
    p.dashX = dirX;
    p.dashY = dirY;
    world.events.push({ type: 'dash', x: p.x, y: p.y });
  }

  let speed = PLAYER_SPEED;
  if (isExhausted(p)) speed *= SLUGGISH_FACTOR;
  if (p.wiredT > 0) speed *= WIRED_FACTOR;

  if (p.dashT > 0) {
    p.dashT -= STEP;
    moveWithCollision(world.office, p, p.dashX * speed * DASH_FACTOR * STEP, p.dashY * speed * DASH_FACTOR * STEP);
    p.moving = true;
    p.walkT += STEP * 2;
    return;
  }

  p.moving = len > 0.1;
  if (p.moving) {
    moveWithCollision(world.office, p, nx * speed * STEP, ny * speed * STEP);
    p.facing = facingFor(nx, ny, p.facing);
    p.walkT += STEP;
  }
}

export function drinkCoffee(player: Player): void {
  player.energy = Math.min(ENERGY_MAX, player.energy + COFFEE_ENERGY);
  player.wiredT = WIRED_SECONDS;
}

export function stun(world: World, seconds: number, text: string, by: 'meeting' | 'boss' = 'meeting'): void {
  const p = world.player;
  p.stunT = seconds;
  p.stunText = text;
  p.stunBy = by;
  p.dashT = 0;
  world.combo = 1;
  world.comboT = 0;
}

export const isFired = (player: Player): boolean => player.strikes >= MAX_STRIKES;
