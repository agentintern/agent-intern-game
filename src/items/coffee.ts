import { PLAYER_RADIUS, STEP } from '../core/constants';
import type { Coffee, World } from '../core/types';
import type { Point } from '../levels/office';
import { drinkCoffee } from '../player/player';

const BREW_SECONDS = 9;
const SIP_RADIUS = PLAYER_RADIUS + 8;

export function stepCoffee(world: World): void {
  const { office, player: p } = world;

  office.coffeeSpots.forEach((spot: Point, index) => {
    const left = world.coffeeCooldowns[index] ?? 0;
    if (world.coffees.some((c) => c.spot === index)) return;
    if (left > 0) {
      world.coffeeCooldowns[index] = left - STEP;
      return;
    }
    world.coffees.push({ id: world.nextId++, x: spot.x, y: spot.y, spot: index });
  });

  if (p.stunT > 0) return;
  for (let i = world.coffees.length - 1; i >= 0; i--) {
    const cup = world.coffees[i] as Coffee;
    if (Math.hypot(cup.x - p.x, cup.y - p.y) < SIP_RADIUS) {
      drinkCoffee(p);
      world.stats.coffees++;
      world.coffeeCooldowns[cup.spot] = BREW_SECONDS;
      world.events.push({ type: 'coffee', x: cup.x, y: cup.y });
      world.coffees.splice(i, 1);
    }
  }
}
