import { ALL_HANDS_AT, LUNCH_AT, LUNCH_ENDS, POWER_FIRST_AT, RUN_SECONDS, RUSH_AT, STEP } from './constants';
import { createRng } from './rng';
import type { Input, World } from './types';
import { createBoss, stepBoss } from '../enemies/boss';
import { stepMeetings } from '../enemies/meetings';
import { stepCoffee } from '../items/coffee';
import { stepPowerups } from '../items/powerups';
import { spawnTask, stepTasks } from '../items/tasks';
import { buildOffice } from '../levels/office';
import { createPlayer, isFired, stepPlayer } from '../player/player';

const BEATS = [
  { at: LUNCH_AT, text: 'LUNCH HOUR. THE OFFICE GOES QUIET.' },
  { at: LUNCH_ENDS, text: 'BACK TO IT. THE BOSS HAD A SALAD.' },
  { at: ALL_HANDS_AT, text: 'ALL HANDS. MORE MEETINGS INCOMING.' },
];

export function createWorld(seed: number): World {
  const office = buildOffice();
  const world: World = {
    seed,
    rng: createRng(seed),
    office,
    phase: 'playing',
    endReason: null,
    time: 0,
    score: 0,
    combo: 1,
    comboT: 0,
    rush: false,
    nextId: 1,
    taskT: 2.2,
    meetingT: 3,
    powerT: POWER_FIRST_AT,
    nearMissT: 0,
    beat: 0,
    player: createPlayer(office.playerStart),
    boss: createBoss(office.bossStart),
    tasks: [],
    coffees: [],
    coffeeCooldowns: office.coffeeSpots.map(() => 0),
    meetings: [],
    powerups: [],
    stats: { tasks: 0, missed: 0, coffees: 0, nearMisses: 0, meetings: 0, bestCombo: 1 },
    events: [],
  };
  spawnTask(world);
  spawnTask(world);
  return world;
}

export function step(world: World, input: Input): void {
  if (world.phase !== 'playing') return;
  world.time += STEP;

  if (!world.rush && world.time >= RUSH_AT) {
    world.rush = true;
    world.events.push({ type: 'rush' });
  }
  const beat = BEATS[world.beat];
  if (beat && world.time >= beat.at) {
    world.beat++;
    world.events.push({ type: 'beat', text: beat.text });
  }

  stepPlayer(world, input);
  stepTasks(world);
  stepCoffee(world);
  stepPowerups(world);
  stepMeetings(world);
  stepBoss(world);

  if (isFired(world.player)) {
    world.phase = 'over';
    world.endReason = 'fired';
  } else if (world.time >= RUN_SECONDS) {
    world.phase = 'over';
    world.endReason = 'clocked-out';
  }
  if (world.endReason) world.events.push({ type: 'over', reason: world.endReason });
}

// The clock runs 09:00 to 17:00 across the 90 seconds of a run.
export function officeClock(time: number): string {
  const minutes = 9 * 60 + Math.min(1, time / RUN_SECONDS) * 8 * 60;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes / 15) * 15 - h * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// The moment before the review card. It's drawn with the clock stopped, so a run's duration holds.
export interface EndingScene {
  title: string;
  line: string;
  seconds: number;
}

export function endingScene(world: World): EndingScene {
  if (world.endReason === 'fired') return { title: 'FIRED', line: 'SECURITY WILL SEE YOU OUT.', seconds: 1.8 };
  const line = world.player.strikes === 0 ? 'NOT ONE STRIKE. NOBODY WILL EVER KNOW.' : 'THE DOOR IS RIGHT THERE. USE IT.';
  return { title: 'CLOCKED OUT', line, seconds: 3.2 };
}

export function nextGoal(score: number): string {
  if (score < 3500) return 'GOAL 3500: MEETS EXPECTATIONS';
  if (score < 8000) return 'GOAL 8000: EXCEEDS EXPECTATIONS';
  if (score < 14000) return 'GOAL 14000: INTERN OF THE MONTH';
  return 'NOW JUST CLOCK OUT AT 17:00';
}

export interface Review {
  stamp: string;
  line: string;
}

export function performanceReview(world: World): Review {
  if (world.endReason === 'fired') {
    return { stamp: 'FIRED', line: 'CLEAN OUT YOUR DESK. IT WAS A BOX.' };
  }
  if (world.score >= 14000) return { stamp: 'INTERN OF THE MONTH', line: 'THERE IS NO SALARY, BUT THERE IS A MUG.' };
  if (world.score >= 8000) return { stamp: 'EXCEEDS EXPECTATIONS', line: 'YOUR REWARD IS MORE WORK.' };
  if (world.score >= 3500) return { stamp: 'MEETS EXPECTATIONS', line: 'NOBODY KNOWS YOUR NAME. THAT IS GOOD.' };
  return { stamp: "LET'S CIRCLE BACK", line: 'HAVE YOU TRIED WORKING HARDER?' };
}
