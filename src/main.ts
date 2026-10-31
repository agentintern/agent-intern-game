import { COMBO_MAX, STEP } from './core/constants';
import { dailySeed, dayNumber } from './core/daily';
import { createWorld, endingScene, step } from './core/sim';
import type { GameEvent, World } from './core/types';
import { isExhausted } from './player/player';
import { exposeDiagnostics, reportRun } from './ui/bridge';
import { Effects } from './ui/effects';
import { drawHud, drawTouchControls } from './ui/hud';
import { listenToPage, type HallEntry } from './ui/inbox';
import { Controls } from './ui/input';
import { paintOffice } from './ui/officeArt';
import { COFFEE, HIGHLIGHT, MINT, SKY, STAMP, VIOLET, WHITE } from './ui/palette';
import { followCamera, renderWorld, type Camera, type View } from './ui/render';
import { drawEnding, drawHall, drawPaused, drawReview, drawTitle, menuRowAt, reviewMenuY, titleMenuY } from './ui/screens';
import { Sound } from './ui/sound';
import { buildSprites } from './ui/sprites';
import { Tutorial } from './ui/tutorial';
import { SITE_ORIGIN } from './version';

type Screen = 'title' | 'hall' | 'playing' | 'paused' | 'ending' | 'review';

// The target for the short side of the screen, in game pixels. Scale is always a whole number
// so the pixels stay square. Portrait zooms in further, since a phone is held close.
const SHORT_SIDE = 280;
const SHORT_SIDE_PORTRAIT = 228;
const REVIEW_ROWS = ['ANOTHER DAY', 'BACK TO THE LOBBY'];

const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d', { alpha: false });
if (!context) throw new Error('canvas 2d is not available');
context.imageSmoothingEnabled = false;

const sprites = buildSprites();
const controls = new Controls(canvas);
const sound = new Sound();
const fx = new Effects();
const tutorial = new Tutorial();

let world: World = createWorld(newSeed());
const view: View = {
  ctx: context,
  width: 480,
  height: 300,
  sprites,
  map: paintOffice(world.office),
};
const camera: Camera = { x: 0, y: 0 };
let scale = 1;
let screen: Screen = 'title';
let clock = 0;
let reviewAt = 0;
let endAt = 0;
let ending = endingScene(world);
let pageDay: number | null = null;
let runDay: number | null = null;
let runLabel = '';
let hall: HallEntry[] = [];
let menu = 0;
let last = performance.now();
let carry = 0;
const diag = { frames: 0, steps: 0, screen: screen as Screen, score: 0, canvasWidth: 0, canvasHeight: 0 };

exposeDiagnostics(diag);

function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function today(): number {
  return pageDay ?? dayNumber(Date.now());
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const deviceW = cssW * dpr;
  const deviceH = cssH * dpr;
  const shortSide = deviceH > deviceW ? SHORT_SIDE_PORTRAIT : SHORT_SIDE;
  const deviceScale = Math.max(1, Math.floor(Math.min(deviceW, deviceH) / shortSide));
  view.width = Math.ceil(deviceW / deviceScale);
  view.height = Math.ceil(deviceH / deviceScale);
  canvas.width = view.width;
  canvas.height = view.height;
  scale = deviceScale / dpr;
  canvas.style.width = `${view.width * scale}px`;
  canvas.style.height = `${view.height * scale}px`;
  context!.imageSmoothingEnabled = false;
  followCamera(view, camera, world.player.x, world.player.y, true);
  diag.canvasWidth = view.width;
  diag.canvasHeight = view.height;
}

function setScreen(next: Screen): void {
  screen = next;
  diag.screen = next;
}

function startRun(day: number | null): void {
  runDay = day;
  runLabel = day === null ? '' : `DAILY #${day}`;
  world = createWorld(day === null ? newSeed() : dailySeed(day));
  fx.clear();
  followCamera(view, camera, world.player.x, world.player.y, true);
  sound.startMusic();
  tutorial.begin();
  controls.read();
  setScreen('playing');
}

function toMenu(next: 'title' | 'review'): void {
  menu = 0;
  reviewAt = clock;
  setScreen(next);
}

const menuRows = (): readonly string[] =>
  screen === 'title' ? [`DAILY SHIFT #${today()}`, 'FREE PLAY', 'HALL OF BOSSES'] : screen === 'review' ? REVIEW_ROWS : [];

controls.canDash = () => screen === 'playing' && controls.usingTouch;

controls.onPrimary = () => {
  sound.unlock();
  if (screen === 'title') {
    if (menu === 0) startRun(today());
    else if (menu === 1) startRun(null);
    else setScreen('hall');
  } else if (screen === 'hall') {
    toMenu('title');
  } else if (screen === 'paused') {
    controls.read();
    setScreen('playing');
  } else if (screen === 'ending' && clock - endAt > 0.6) {
    toMenu('review');
  } else if (screen === 'review' && clock - reviewAt > 0.9) {
    if (menu === 0) startRun(runDay === null ? null : today());
    else toMenu('title');
  }
};

controls.onPause = () => {
  if (screen === 'playing') setScreen('paused');
  else if (screen === 'paused') setScreen('playing');
  else if (screen === 'hall') toMenu('title');
};

controls.onMenu = (move) => {
  const count = menuRows().length;
  if (count > 0) menu = (menu + move + count) % count;
};

// A tap picks a row and the same press activates it. A tap anywhere else takes the selected row.
controls.onTap = (_x, y) => {
  const row = menuRowAt(screen === 'title' ? titleMenuY(view) : reviewMenuY(view), menuRows().length, y / scale);
  if (row >= 0) menu = row;
};

controls.onMute = () => {
  sound.unlock();
  sound.toggleMute();
};

function handle(event: GameEvent): void {
  switch (event.type) {
    case 'task':
      fx.burst(event.x, event.y, event.kind === 'urgent' ? STAMP : HIGHLIGHT, 12 + event.combo * 4, 50 + event.combo * 12);
      fx.popup(event.x, event.y - 10, `+${event.points}`, event.combo > 2 ? HIGHLIGHT : WHITE);
      sound.task(event.combo);
      fx.shake = Math.max(fx.shake, 0.1 * event.combo);
      if (world.combo === COMBO_MAX) {
        if (event.combo < COMBO_MAX) fx.popup(event.x, event.y - 20, 'MAX COMBO', STAMP);
        fx.hitstop = 0.07;
      }
      break;
    case 'task-missed':
      fx.popup(event.x, event.y - 8, 'MISSED', STAMP);
      fx.burst(event.x, event.y, '#6d7482', 6, 30);
      sound.missed();
      break;
    case 'task-tick':
      sound.tick();
      break;
    case 'coffee':
      fx.burst(event.x, event.y, SKY, 12, 40);
      fx.burst(event.x, event.y, COFFEE, 10, 70);
      fx.popup(event.x, event.y - 10, 'WIRED', SKY);
      fx.shake = Math.max(fx.shake, 0.25);
      sound.coffee();
      break;
    case 'power':
      fx.burst(event.x, event.y, MINT, 18, 80);
      fx.popup(
        event.x,
        event.y - 10,
        event.kind === 'headphones' ? 'NOISE CANCELLED' : event.kind === 'auto-reply' ? 'OUT OF OFFICE' : 'MEETINGS STAPLED',
        MINT,
      );
      sound.power();
      break;
    case 'beat':
      fx.banner = event.text;
      fx.bannerT = 3.2;
      break;
    case 'dash':
      fx.burst(event.x, event.y, WHITE, 5, 34);
      sound.dash();
      break;
    case 'near-miss':
      fx.popup(event.x, event.y - 12, `CLOSE CALL +${event.points}`, MINT);
      sound.nearMiss();
      break;
    case 'meeting':
      fx.burst(event.x, event.y, VIOLET, 16);
      fx.shake = 0.6;
      fx.hitstop = 0.05;
      sound.meeting();
      break;
    case 'boss-alert':
      fx.popup(event.x, event.y - 22, 'HEY YOU', STAMP);
      sound.alert();
      break;
    case 'caught':
      fx.burst(event.x, event.y, STAMP, 22, 90);
      fx.shake = 1.4;
      fx.flash = 0.5;
      fx.flashColor = STAMP;
      fx.hitstop = 0.14;
      sound.caught();
      break;
    case 'rush':
      fx.flash = 0.35;
      fx.flashColor = HIGHLIGHT;
      sound.rush();
      break;
    case 'over':
      sound.stopMusic();
      sound.over(event.reason === 'clocked-out');
      if (event.reason === 'clocked-out') fx.burst(world.player.x, world.player.y, HIGHLIGHT, 60, 110);
      ending = endingScene(world);
      endAt = clock;
      setScreen('ending');
      reportRun(world);
      break;
  }
}

function update(dt: number): void {
  // Hit pause holds back whole steps and nothing else, so the simulation can't tell it happened.
  carry = fx.hitstop > 0 ? 0 : Math.min(carry + dt, STEP * 5);
  while (carry >= STEP && screen === 'playing') {
    carry -= STEP;
    step(world, controls.read());
    diag.steps++;
    for (const event of world.events) handle(event);
    world.events.length = 0;
    if (fx.hitstop > 0) carry = 0;
  }
  if (screen === 'playing') tutorial.update(world, dt);
  if (screen === 'ending' && clock - endAt > ending.seconds) toMenu('review');
  followCamera(view, camera, world.player.x, world.player.y);
  fx.update(dt);
  sound.chased = screen === 'playing' && world.boss.state === 'chase';
  sound.update();
  diag.score = world.score;
}

function draw(): void {
  renderWorld(view, camera, world, fx, screen !== 'title');
  if (screen === 'title') {
    drawTitle(view, controls.usingTouch || navigator.maxTouchPoints > 0, clock, menuRows(), menu);
    return;
  }
  if (screen === 'hall') {
    drawHall(view, hall, clock);
    return;
  }
  drawHud(view, world, runLabel, fx, !tutorial.active);
  if (screen === 'playing') tutorial.draw(view, camera, world, controls.usingTouch);
  if (controls.usingTouch && screen === 'playing') {
    drawTouchControls(view, controls.stick, scale, controls.dashButton(), !isExhausted(world.player));
  }
  if (screen === 'paused') drawPaused(view);
  if (screen === 'ending') drawEnding(view, world, ending, clock - endAt);
  if (screen === 'review') drawReview(view, world, runLabel, REVIEW_ROWS, menu, clock - reviewAt);
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  update(dt);
  draw();
  diag.frames++;
  requestAnimationFrame(frame);
}

listenToPage(SITE_ORIGIN, (message) => {
  if (message.type === 'daily') pageDay = message.day;
  else hall = message.bosses;
});

window.addEventListener('resize', resize);
window.addEventListener('blur', () => {
  if (screen === 'playing') setScreen('paused');
});

resize();
requestAnimationFrame(frame);


