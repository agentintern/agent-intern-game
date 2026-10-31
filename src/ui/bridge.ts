import { GAME_VERSION, SITE_ORIGIN } from '../version';
import type { World } from '../core/types';

// The game has no network access. A finished run is handed to the page that embeds it,
// and that page decides what to do with the numbers. This is the only message it sends.
export function reportRun(world: World): void {
  if (window.parent === window) return;
  window.parent.postMessage(
    {
      source: 'agent-intern-game',
      type: 'run-finished',
      score: world.score,
      tasks: world.stats.tasks,
      coffees: world.stats.coffees,
      nearMisses: world.stats.nearMisses,
      duration: Math.round(world.time * 10) / 10,
      seed: world.seed,
      version: GAME_VERSION,
    },
    SITE_ORIGIN,
  );
}
