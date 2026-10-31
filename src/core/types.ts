import type { Rng } from './rng';
import type { Office } from '../levels/office';

export type Facing = 'down' | 'up' | 'left' | 'right';
export type Phase = 'playing' | 'over';
export type EndReason = 'clocked-out' | 'fired';

export interface Input {
  moveX: number;
  moveY: number;
  dash: boolean;
}

export interface Player {
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  energy: number;
  wiredT: number;
  dashT: number;
  dashCooldown: number;
  dashX: number;
  dashY: number;
  stunT: number;
  stunText: string;
  stunBy: 'meeting' | 'boss';
  iframes: number;
  strikes: number;
  walkT: number;
  quietT: number;
  awayT: number;
}

export type TaskKind = 'email' | 'sheet' | 'report' | 'urgent' | 'call' | 'project';
export type PowerKind = 'headphones' | 'auto-reply';

export interface Task {
  id: number;
  kind: TaskKind;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  work: number;
  need: number;
  value: number;
}

export interface Coffee {
  id: number;
  x: number;
  y: number;
  spot: number;
}

export interface Powerup {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
  life: number;
}

export interface Meeting {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  title: string;
  brushed: boolean;
}

export type BossState = 'waiting' | 'patrol' | 'alert' | 'chase' | 'cooldown';

export interface Boss {
  x: number;
  y: number;
  state: BossState;
  timer: number;
  facing: Facing;
  angle: number;
  waypoint: number;
  lostT: number;
  field: Int16Array | null;
  fieldT: number;
  walkT: number;
}

export type GameEvent =
  | { type: 'task'; x: number; y: number; points: number; combo: number; kind: TaskKind }
  | { type: 'task-missed'; x: number; y: number }
  | { type: 'task-tick'; x: number; y: number }
  | { type: 'coffee'; x: number; y: number }
  | { type: 'dash'; x: number; y: number }
  | { type: 'meeting'; x: number; y: number; title: string }
  | { type: 'near-miss'; x: number; y: number; points: number }
  | { type: 'boss-alert'; x: number; y: number }
  | { type: 'caught'; x: number; y: number; strikes: number }
  | { type: 'power'; x: number; y: number; kind: PowerKind }
  | { type: 'beat'; text: string }
  | { type: 'rush' }
  | { type: 'over'; reason: EndReason };

export interface Stats {
  tasks: number;
  missed: number;
  coffees: number;
  nearMisses: number;
  meetings: number;
  bestCombo: number;
}

export interface World {
  seed: number;
  rng: Rng;
  office: Office;
  phase: Phase;
  endReason: EndReason | null;
  time: number;
  score: number;
  combo: number;
  comboT: number;
  rush: boolean;
  nextId: number;
  taskT: number;
  meetingT: number;
  powerT: number;
  nearMissT: number;
  beat: number;
  player: Player;
  boss: Boss;
  tasks: Task[];
  coffees: Coffee[];
  coffeeCooldowns: number[];
  meetings: Meeting[];
  powerups: Powerup[];
  stats: Stats;
  events: GameEvent[];
}
