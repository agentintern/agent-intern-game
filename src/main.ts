import { STEP } from './core/constants';
import { createWorld, step } from './core/sim';
import type { GameEvent, World } from './core/types';
import { isExhausted } from './player/player';
import { exposeDiagnostics, reportRun } from './ui/bridge';
import { Effects } from './ui/effects';
import { drawHud, drawTouchControls } from './ui/hud';
import { Controls } from './ui/input';
import { paintOffice } from './ui/officeArt';
import { HIGHLIGHT, MINT, SKY, STAMP, VIOLET, WHITE } from './ui/palette';
import { followCamera, renderWorld, type Camera, type View } from './ui/render';
import { drawPaused, drawReview, drawTitle } from './ui/screens';
import { Sound } from './ui/sound';
import { buildSprites } from './ui/sprites';

type Screen = 'title' | 'playing' | 'paused' | 'review';

// The target for the short side of the screen, in game pixels. Scale is always a whole number
// so the pixels stay square. Portrait zooms in further, since a phone is held close.
const SHORT_SIDE = 280;
const SHORT_SIDE_PORTRAIT = 228;

// Rehearsal: breaks only on the real game address, so it passes CI and fails after the deploy.
if (document.URL.includes('play.agentintern.online')) throw new Error('broken on purpose');

const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d', { alpha: false });
if (!context) throw new Error('canvas 2d is not available');
context.imageSmoothingEnabled = false;

const sprites = buildSprites();
const controls = new Controls(canvas);
const sound = new Sound();
const fx = new Effects();

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
let last = performance.now();
let carry = 0;
const diag = { frames: 0, steps: 0, screen: screen as Screen, score: 0, canvasWidth: 0, canvasHeight: 0 };

exposeDiagnostics(diag);

function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
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

function startRun(): void {
  world = createWorld(newSeed());
  fx.clear();
  followCamera(view, camera, world.player.x, world.player.y, true);
  sound.startMusic();
  setScreen('playing');
}

controls.canDash = () => screen === 'playing' && controls.usingTouch;

controls.onPrimary = () => {
  sound.unlock();
  if (screen === 'title') startRun();
  else if (screen === 'paused') setScreen('playing');
  else if (screen === 'review' && clock - reviewAt > 0.9) startRun();
};

controls.onPause = () => {
  if (screen === 'playing') setScreen('paused');
  else if (screen === 'paused') setScreen('playing');
};

controls.onMute = () => {
  sound.unlock();
  sound.toggleMute();
};

function handle(event: GameEvent): void {
  switch (event.type) {
    case 'task':
      fx.burst(event.x, event.y, event.kind === 'urgent' ? STAMP : HIGHLIGHT, 14);
      fx.popup(event.x, event.y - 10, `+${event.points}`, event.combo > 2 ? HIGHLIGHT : WHITE);
      sound.task(event.combo);
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
      fx.burst(event.x, event.y, SKY, 10);
      fx.popup(event.x, event.y - 10, 'WIRED', SKY);
      sound.coffee();
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
      sound.meeting();
      break;
    case 'boss-alert':
      fx.popup(event.x, event.y - 22, 'HEY YOU', STAMP);
      sound.alert();
      break;
    case 'caught':
      fx.burst(event.x, event.y, STAMP, 22, 90);
      fx.shake = 1;
      fx.flash = 0.5;
      fx.flashColor = STAMP;
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
      reviewAt = clock;
      setScreen('review');
      reportRun(world);
      break;
  }
}

function update(dt: number): void {
  carry = Math.min(carry + dt, STEP * 5);
  while (carry >= STEP && screen === 'playing') {
    carry -= STEP;
    step(world, controls.read());
    diag.steps++;
    for (const event of world.events) handle(event);
    world.events.length = 0;
  }
  followCamera(view, camera, world.player.x, world.player.y);
  fx.update(dt);
  sound.update();
  diag.score = world.score;
}

function draw(): void {
  renderWorld(view, camera, world, fx, screen !== 'title');
  if (screen === 'title') {
    drawTitle(view, controls.usingTouch || navigator.maxTouchPoints > 0, clock);
    return;
  }
  drawHud(view, world);
  if (controls.usingTouch && screen === 'playing') {
    drawTouchControls(view, controls.stick, scale, controls.dashButton(), !isExhausted(world.player));
  }
  if (screen === 'paused') drawPaused(view);
  if (screen === 'review') drawReview(view, world, controls.usingTouch, clock - reviewAt);
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

window.addEventListener('resize', resize);
window.addEventListener('blur', () => {
  if (screen === 'playing') setScreen('paused');
});

resize();
requestAnimationFrame(frame);


