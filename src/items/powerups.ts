import { PLAYER_RADIUS, POWER_EVERY, POWER_LIFE, POWER_SECONDS, STEP } from '../core/constants';
import type { PowerKind, Powerup, World } from '../core/types';

const KINDS: readonly PowerKind[] = ['headphones', 'auto-reply'];
const GRAB_RADIUS = PLAYER_RADIUS + 9;

function spawnPowerup(world: World): void {
  const { rng, office, player } = world;
  for (let attempt = 0; attempt < 30; attempt++) {
    const spot = rng.pick(office.taskSpots);
    if (Math.hypot(spot.x - player.x, spot.y - player.y) < 60) continue;
    world.powerups.push({ id: world.nextId++, kind: rng.pick(KINDS), x: spot.x, y: spot.y, life: POWER_LIFE });
    return;
  }
}

// Power-ups keep you out of trouble and never pay, so they can't touch the score ceiling.
export function stepPowerups(world: World): void {
  const p = world.player;
  world.powerT -= STEP;
  if (world.powerT <= 0) {
    spawnPowerup(world);
    world.powerT = POWER_EVERY;
  }
  for (let i = world.powerups.length - 1; i >= 0; i--) {
    const item = world.powerups[i] as Powerup;
    item.life -= STEP;
    if (p.stunT <= 0 && Math.hypot(item.x - p.x, item.y - p.y) < GRAB_RADIUS) {
      if (item.kind === 'headphones') p.quietT = POWER_SECONDS;
      else p.awayT = POWER_SECONDS;
      world.events.push({ type: 'power', x: item.x, y: item.y, kind: item.kind });
      world.powerups.splice(i, 1);
    } else if (item.life <= 0) world.powerups.splice(i, 1);
  }
}
