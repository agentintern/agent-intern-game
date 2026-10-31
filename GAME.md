# How the game works

**Last Day at the Office.** You're a tired robot intern in a top-down office. Finish tasks, drink coffee,
dodge meetings, stay out of the boss's sight. A run is 90 seconds, which is one workday on the office
clock, 09:00 to 17:00.

## Rules

| Thing | What it does |
| --- | --- |
| **Tasks** | Paper on the floor by a desk. Stand next to it until the ring fills. Each has a life bar, and missing one costs a combo step. |
| **Combo** | Each finished task raises your multiplier, up to ×5, for 8.5 seconds. A meeting or the boss resets it. |
| **Energy** | Drains all day. At zero you walk slowly and can't dash. |
| **Coffee** | Sits by each machine and brews again 9 seconds after you take it. Gives energy, 4 seconds of being wired (faster moves, faster work) and a full combo timer. |
| **Dash** | A short burst, 0.17 s, that passes through meetings and the boss. Costs 9 energy. |
| **Meetings** | Angry calendar invites that drift and bounce. Touching one stops you for 2 seconds and shows you its title. Slipping past one is a close call, worth points. |
| **The boss** | Patrols the office with a visible cone of sight, blocked by walls, plants, partitions and cabinets. If you're seen, the boss chases you. If caught you get a strike, and three strikes means you're fired. |
| **5 o'clock rush** | The last 22 seconds: tasks come faster and pay ×1.5. |
| **Calls and projects** | A call takes a moment but lasts 6 seconds. A project takes 2.2 seconds of standing still and moves your combo two steps. |
| **Power-ups** | One appears every 17 seconds. Headphones walk you through meetings. An auto-reply hides you from the boss and ends a chase. Both last 7 seconds and pay nothing. |
| **The day** | 12:00 is lunch: fewer tasks and meetings, half the energy drain. 14:30 is all hands: two more meetings. Then the rush. |
| **17:00** | Clocking out gets its own moment, and being fired gets a different one. The clock is stopped for both. |
| **First run** | Short prompts appear as you walk to a task, finish it, grab coffee and dash. Each ends when you do the thing or after a few seconds. |

Task values: email 50, sheet 90, report 140, urgent 220 (after 25 s), call 120, project 220. All tuning numbers are in
`src/core/constants.ts` and `src/items/tasks.ts`.

## Daily Shift and the page

The title offers DAILY SHIFT (first), FREE PLAY and HALL OF BOSSES, by keyboard or tap. A daily plays
`dailySeed(dayNumber(Date.now()))` from `src/core/daily.ts`, or the day the page sends. The site runs the same
formula, so change them together. The page handles attempts and sharing.

`src/ui/inbox.ts` listens to the site's origin and accepts two shapes, ignoring all else:
`{ source: 'agent-intern-site', type: 'daily', day }` and `{ source: 'agent-intern-site', type: 'hall', bosses: [{ task, by }] }`.
Strings are capped and only drawn with the bitmap font. The game runs fine with no message at all.

The tutorial, hit pause and shake live in `ui/` and `main.ts` and never touch the world, so they can't change a
replay.

## Score ceiling

The site rejects a score above tasks × 1650 + close calls × 125, or more than 2 of either per second. A task pays
1650 at most, a close call 125, close calls are 0.5 s apart, and nothing else pays. `tests/depth.test.ts` checks it.

## Code

The simulation and the screen are separate. Everything under `core`, `player`, `enemies`, `levels`
and `items` runs without a browser, on a fixed 60 Hz step and a seeded random generator, so a seed
replays the same way. `ui` only reads the world and draws it.

| Folder | What's in it |
| --- | --- |
| `src/core/` | `sim.ts` steps the world. `constants.ts`, `rng.ts` and `types.ts` support it. |
| `src/player/` | Movement, collision, dash, energy, stun. |
| `src/enemies/` | `boss.ts` (patrol, sight, chase) and `meetings.ts`. |
| `src/levels/` | `office.ts`: the map as text, line of sight and path distances. |
| `src/items/` | `tasks.ts`, `coffee.ts` and `powerups.ts`. |
| `src/ui/` | Sprites as text, painted office art, jokes, renderer, HUD, screens, tutorial, input, sound, bridge, inbox. |
| `src/main.ts` | The browser loop. Handles world events: particles, sound, screens. |
| `tests/` | Runs with no browser. `bot.ts` is a simple player used to run whole games. |

Events are how the sim talks to the screen. It pushes `GameEvent`s and `main.ts` turns them into
effects and sound. To add a thing, add it to the sim, emit an event, then draw it.

## Limits worth knowing

- The game has no network access. `config/_headers` sets `connect-src 'none'`.
- `src/ui/bridge.ts` sends one message to the embedding page when a run ends. That's the only thing
  that leaves the game. `src/ui/inbox.ts` is the only thing that comes in.
- It runs in a sandboxed iframe with no storage, so nothing can persist between visits.
- There are no asset files. Sprites are text in `sprites.ts`, the font is in `font.ts`, the office is
  painted in `officeArt.ts`, and the sound is synthesized in `sound.ts`.

## Balance

Sampled with the bots in `tests/bot.ts` over 40 seeds: a plain bot that ignores the boss has a median
of about 7,100 and a top decile around 12,000, and survives to 17:00 about half the time. The review
stamps sit at 3,500, 8,000 and 14,000.

## Coffee machines

There are three. A cup sits by each one and brews again 9 seconds after you take it.
