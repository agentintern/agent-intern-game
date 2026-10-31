import { MEETING_RADIUS, MEETING_STUN, NEAR_MISS_POINTS, NEAR_MISS_RADIUS, PLAYER_RADIUS, RUN_SECONDS, STEP, TILE } from '../core/constants';
import type { Meeting, World } from '../core/types';
import { isSolidAt } from '../levels/office';
import { isInvulnerable, stun } from '../player/player';

const TITLES = [
  'QUICK SYNC ABOUT SYNCING',
  'CIRCLE BACK ON CIRCLES',
  'PRE-MEETING MEETING',
  'ALIGNMENT ON ALIGNMENT',
  'THIS COULD BE AN EMAIL',
  'MANDATORY FUN BRIEFING',
  'Q3 VIBES CHECK',
  'WHO MOVED THE STAPLER',
  'LESSONS LEARNED, AGAIN',
  'STANDUP, SITTING DOWN',
  'TOWN HALL, BUT LONGER',
  'SLIDES ABOUT THE SLIDES',
];

export function wantedMeetings(time: number): number {
  return 2 + Math.floor((time / RUN_SECONDS) * 6);
}

function spawnMeeting(world: World): void {
  const { rng, office, player } = world;
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = (1 + rng.int(38)) * TILE + TILE / 2;
    const y = (1 + rng.int(26)) * TILE + TILE / 2;
    if (isSolidAt(office, x, y)) continue;
    if (Math.hypot(x - player.x, y - player.y) < 90) continue;
    const angle = rng.next() * Math.PI * 2;
    const speed = 30 + (world.time / RUN_SECONDS) * 28 + rng.next() * 12;
    world.meetings.push({
      id: world.nextId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      title: rng.pick(TITLES),
      brushed: false,
    });
    return;
  }
}

function drift(world: World, m: Meeting): void {
  const r = MEETING_RADIUS;
  const nx = m.x + m.vx * STEP;
  if (isSolidAt(world.office, nx + Math.sign(m.vx) * r, m.y)) m.vx = -m.vx;
  else m.x = nx;
  const ny = m.y + m.vy * STEP;
  if (isSolidAt(world.office, m.x, ny + Math.sign(m.vy) * r)) m.vy = -m.vy;
  else m.y = ny;
}

export function stepMeetings(world: World): void {
  world.meetingT -= STEP;
  if (world.meetings.length < wantedMeetings(world.time) && world.meetingT <= 0) {
    spawnMeeting(world);
    world.meetingT = 2.5;
  }

  const p = world.player;
  for (let i = world.meetings.length - 1; i >= 0; i--) {
    const m = world.meetings[i] as Meeting;
    drift(world, m);
    const dist = Math.hypot(m.x - p.x, m.y - p.y);

    if (dist < MEETING_RADIUS + PLAYER_RADIUS && !isInvulnerable(p)) {
      stun(world, MEETING_STUN, m.title);
      world.stats.meetings++;
      world.events.push({ type: 'meeting', x: p.x, y: p.y, title: m.title });
      world.meetings.splice(i, 1);
      world.meetingT = 3;
      continue;
    }

    if (dist < NEAR_MISS_RADIUS && p.moving && p.stunT <= 0 && !m.brushed) {
      m.brushed = true;
    } else if (m.brushed && dist > NEAR_MISS_RADIUS + 6) {
      m.brushed = false;
      if (p.stunT <= 0) {
        const points = NEAR_MISS_POINTS * world.combo;
        world.score += points;
        world.stats.nearMisses++;
        world.events.push({ type: 'near-miss', x: p.x, y: p.y, points });
      }
    }
  }
}
