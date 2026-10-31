// Every tuning number for a run lives here, so balance changes stay in one file.
export const TILE = 16;
export const STEP = 1 / 60;
export const RUN_SECONDS = 90;
export const RUSH_AT = 68;
export const LUNCH_AT = 33.75;
export const LUNCH_ENDS = 45;
export const ALL_HANDS_AT = 56.25;
export const isLunch = (time: number): boolean => time >= LUNCH_AT && time < LUNCH_ENDS;

export const PLAYER_SPEED = 84;
export const PLAYER_RADIUS = 5;
export const SLUGGISH_FACTOR = 0.62;
export const WIRED_FACTOR = 1.28;
export const WIRED_SECONDS = 4;

export const ENERGY_MAX = 100;
export const ENERGY_DRAIN = 1.9;
export const COFFEE_ENERGY = 42;

export const DASH_SECONDS = 0.17;
export const DASH_FACTOR = 3.1;
export const DASH_COST = 9;
export const DASH_COOLDOWN = 0.65;

export const WORK_RADIUS = 19;
export const COMBO_SECONDS = 8.5;
export const COMBO_MAX = 5;
export const RUSH_MULTIPLIER = 1.5;
export const NEAR_MISS_POINTS = 25;
export const NEAR_MISS_RADIUS = 17;
export const NEAR_MISS_GAP = 0.5;

// The site rejects a run above these, so no single award may pass them.
export const MAX_TASK_POINTS = 1650;
export const MAX_NEAR_MISS_POINTS = 125;

export const POWER_FIRST_AT = 14;
export const POWER_EVERY = 17;
export const POWER_LIFE = 11;
export const POWER_SECONDS = 7;

export const MEETING_RADIUS = 7;
export const MEETING_STUN = 2;
export const BOSS_STUN = 1.6;
export const IFRAMES_AFTER_STUN = 1.4;
export const MAX_STRIKES = 3;

export const BOSS_START_DELAY = 5;
export const BOSS_PATROL_SPEED = 46;
export const BOSS_CHASE_SPEED = 72;
export const BOSS_RADIUS = 7;
export const BOSS_SIGHT_RANGE = 92;
export const BOSS_SIGHT_HALF_ANGLE = 0.95;
export const BOSS_ALERT_SECONDS = 0.45;
export const BOSS_GIVE_UP_SECONDS = 1.4;
export const BOSS_COOLDOWN_SECONDS = 4.5;
