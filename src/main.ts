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
import { COFFEE, HIGHLIGHT, MINT, PAPER_DIM, SKY, STAMP, VIOLET, WHITE } from './ui/palette';
import { renderWorld } from './ui/marks';
import { followCamera, newCamera, prepare, tourCamera, type View } from './ui/stage';
import { drawEnding, drawHall, drawPaused, drawReview, drawTitle, menuRowAt, reviewMenuY, titleMenuY } from './ui/screens';
import { Sound } from './ui/sound';
import { Tutorial } from './ui/tutorial';
import { SITE_ORIGIN } from './version';

type Screen = 'title' | 'hall' | 'playing' | 'paused' | 'ending' | 'review';

// The target for the short side of the screen, in HUD pixels. Scale is always a whole number of
// canvas pixels, so the bitmap font stays square. Portrait is larger, since a phone is held close.
const SHORT_SIDE = 280;
const SHORT_SIDE_PORTRAIT = 228;
// How much office fits across the short side of the screen, in iso pixels. This sets how far ahead a phone can see.
const VIEW_SHORT = 320;
const MAX_ZOOM_CSS = 2.2;
// The world draws at device resolution up to these caps. Past them nobody can see the difference.
const MAX_ZOOM = 3;
const MAX_PIXELS = [1_900_000, 1_900_000, 520_000];
const PACE_LIMIT = 1 / 40;
const PACE_WINDOW = 3;
const REVIEW_ROWS = ['ANOTHER DAY', 'BACK TO THE LOBBY'];

const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d', { alpha: false });
if (!context) throw new Error('canvas 2d is not available');
canvas.style.imageRendering = 'auto';

const controls = new Controls(canvas);
const sound = new Sound();
const fx = new Effects();
const tutorial = new Tutorial();

let world: World = createWorld(newSeed());
const view: View = {
  ctx: context,
  width: 480,
  height: 300,
  unit: 1,
  zoom: 2,
  canvasW: 480,
  canvasH: 300,
  quality: 0,
  scene: null,
  office: world.office,
  sprites: new Map(),
  faces: { player: 'sw', boss: 'sw' },
  seen: { x: 0, y: 0 },
};
const camera = newCamera();
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
let slowFrames = 0;
let paceFrames = 0;
let paceTime = 0;
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
  const zoomCss = Math.min(MAX_ZOOM_CSS, Math.max(1, Math.min(cssW, cssH) / VIEW_SHORT));
  const limit = MAX_PIXELS[view.quality] as number;
  const density = Math.min(dpr, MAX_ZOOM / zoomCss, Math.sqrt(limit / (cssW * cssH)));
  canvas.width = Math.round(cssW * density);
  canvas.height = Math.round(cssH * density);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  view.canvasW = canvas.width;
  view.canvasH = canvas.height;
  // A small change keeps the old size, so a phone's address bar sliding away doesn't repaint the building.
  const wanted = Math.round(zoomCss * density * 10) / 10;
  const had = view.scene?.zoom;
  view.zoom = had && Math.abs(had - wanted) / wanted < 0.12 ? had : wanted;
  const shortSide = canvas.height > canvas.width ? SHORT_SIDE_PORTRAIT : SHORT_SIDE;
  view.unit = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / shortSide));
  view.width = Math.ceil(canvas.width / view.unit);
  view.height = Math.ceil(canvas.height / view.unit);
  scale = cssW / (canvas.width / view.unit);
  prepare(view, view.zoom);
  followCamera(view, camera, world.player.x, world.player.y, true);
  diag.canvasWidth = canvas.width;
  diag.canvasHeight = canvas.height;
}

function setScreen(next: Screen): void {
  screen = next;
  diag.screen = next;
}

function startRun(day: number | null): void {
  runDay = day;
  runLabel = day === null ? '' : `DAILY #${day}`;
  world = createWorld(day === null ? newSeed() : dailySeed(day));
  view.office = world.office;
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
    case 'printer-jam':
      fx.popup(event.x, event.y - 10, 'JAMMED', STAMP);
      fx.burst(event.x, event.y, PAPER_DIM, 10, 40);
      sound.jam();
      break;
    case 'printer-clear':
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
  if (screen === 'title') tourCamera(camera, clock);
  else followCamera(view, camera, world.player.x, world.player.y);
  fx.update(dt);
  sound.chased = screen === 'playing' && world.boss.state === 'chase';
  sound.update();
  diag.score = world.score;
}

function draw(): void {
  renderWorld(view, camera, world, fx, screen !== 'title', screen !== 'playing' || tutorial.active);
  context!.setTransform(view.unit, 0, 0, view.unit, 0, 0);
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

// Under 40 fps for 3 seconds, most of the frames being slow: first the lights go, then sharpness. Nothing you need
// to play is in either. The median, not the mean, because one long stall isn't a slow machine.
function watchPace(seconds: number): void {
  paceTime += seconds;
  paceFrames++;
  if (seconds > PACE_LIMIT) slowFrames++;
  if (paceTime < PACE_WINDOW) return;
  const struggling = slowFrames > paceFrames / 2;
  paceTime = paceFrames = slowFrames = 0;
  if (!struggling || view.quality >= 2) return;
  view.quality++;
  if (view.quality === 2) resize();
}

function frame(now: number): void {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  clock += dt;
  watchPace(elapsed);
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


