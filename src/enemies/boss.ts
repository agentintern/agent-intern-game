import {
  BOSS_ALERT_SECONDS, BOSS_CHASE_SPEED, BOSS_COOLDOWN_SECONDS, BOSS_GIVE_UP_SECONDS, BOSS_PATROL_SPEED,
  BOSS_RADIUS, BOSS_SIGHT_HALF_ANGLE, BOSS_SIGHT_RANGE, BOSS_START_DELAY, BOSS_STUN, PLAYER_RADIUS,
  RUN_SECONDS, STEP, TILE,
} from '../core/constants';
import type { Boss, Facing, World } from '../core/types';
import { distanceField, hasLineOfSight, nextStep, type Point } from '../levels/office';
import { isInvulnerable, stun } from '../player/player';

const LINES = ['MY OFFICE. NOW.', 'GOT A MINUTE?', 'WE NEED TO TALK', 'PER MY LAST EMAIL...'];

export function createBoss(start: Point): Boss {
  return {
    x: start.x,
    y: start.y,
    state: 'waiting',
    timer: BOSS_START_DELAY,
    facing: 'down',
    angle: Math.PI / 2,
    waypoint: 0,
    lostT: 0,
    field: null,
    fieldT: 0,
    walkT: 0,
  };
}

export function canSeePlayer(world: World): boolean {
  const { boss, player: p, office } = world;
  const dx = p.x - boss.x;
  const dy = p.y - boss.y;
  const dist = Math.hypot(dx, dy);
  if (dist > BOSS_SIGHT_RANGE) return false;
  if (dist > TILE * 1.5) {
    let diff = Math.atan2(dy, dx) - boss.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > BOSS_SIGHT_HALF_ANGLE) return false;
  }
  return hasLineOfSight(office, boss.x, boss.y, p.x, p.y);
}

function faceToward(boss: Boss, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const target = Math.atan2(dy, dx);
  let diff = target - boss.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  boss.angle += diff * Math.min(1, 9 * STEP);
  const facing: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  boss.facing = facing;
}

function walkField(world: World, speed: number): boolean {
  const { boss } = world;
  if (!boss.field) return false;
  const next = nextStep(boss.field, boss.x, boss.y);
  if (!next) return false;
  const dx = next.x - boss.x;
  const dy = next.y - boss.y;
  const len = Math.hypot(dx, dy) || 1;
  boss.x += (dx / len) * speed * STEP;
  boss.y += (dy / len) * speed * STEP;
  boss.walkT += STEP;
  faceToward(boss, dx, dy);
  return true;
}

function headFor(world: World, target: Point): void {
  world.boss.field = distanceField(world.office, target.x, target.y);
  world.boss.fieldT = 0.3;
}

function nextWaypoint(world: World): void {
  const { boss, office } = world;
  boss.waypoint = (boss.waypoint + 1) % office.bossRoute.length;
  headFor(world, office.bossRoute[boss.waypoint] as Point);
}

export function stepBoss(world: World): void {
  const { boss, player: p } = world;
  const lateness = world.time / RUN_SECONDS;
  boss.timer -= STEP;
  boss.fieldT -= STEP;

  switch (boss.state) {
    case 'waiting':
      if (boss.timer <= 0) {
        boss.state = 'patrol';
        headFor(world, world.office.bossRoute[0] as Point);
      }
      return;

    case 'patrol': {
      if (!walkField(world, BOSS_PATROL_SPEED * (1 + lateness * 0.3))) nextWaypoint(world);
      if (canSeePlayer(world) && !isInvulnerable(p)) {
        boss.state = 'alert';
        boss.timer = BOSS_ALERT_SECONDS;
        world.events.push({ type: 'boss-alert', x: boss.x, y: boss.y });
      }
      return;
    }

    case 'alert':
      faceToward(boss, p.x - boss.x, p.y - boss.y);
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.lostT = BOSS_GIVE_UP_SECONDS;
        headFor(world, p);
      }
      return;

    case 'chase': {
      if (boss.fieldT <= 0) headFor(world, p);
      walkField(world, BOSS_CHASE_SPEED * (1 + lateness * 0.2));
      boss.lostT = canSeePlayer(world) ? BOSS_GIVE_UP_SECONDS : boss.lostT - STEP;
      if (boss.lostT <= 0) {
        boss.state = 'patrol';
        headFor(world, world.office.bossRoute[boss.waypoint] as Point);
      }
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BOSS_RADIUS + PLAYER_RADIUS && !isInvulnerable(p)) {
        p.strikes++;
        stun(world, BOSS_STUN, world.rng.pick(LINES), 'boss');
        world.events.push({ type: 'caught', x: p.x, y: p.y, strikes: p.strikes });
        boss.state = 'cooldown';
        boss.timer = BOSS_COOLDOWN_SECONDS;
      }
      return;
    }

    case 'cooldown':
      if (boss.timer <= 0) {
        boss.state = 'patrol';
        headFor(world, world.office.bossRoute[boss.waypoint] as Point);
      }
      return;
  }
}
