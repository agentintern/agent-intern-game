import type { Input } from '../core/types';
import { keysToScreen, screenDirToWorld } from './iso';

export interface Stick {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

const STICK_RANGE = 46;

// Keyboard and touch both end up as the same Input. Pointer positions are in CSS pixels.
export class Controls {
  private keys = new Set<string>();
  private dashQueued = false;
  private stickId: number | null = null;
  readonly stick: Stick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };
  usingTouch = false;
  onPrimary: () => void = () => {};
  onPause: () => void = () => {};
  onMute: () => void = () => {};
  onMenu: (step: number) => void = () => {};
  onTap: (x: number, y: number) => void = () => {};
  canDash: () => boolean = () => false;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('pointerdown', this.pointerDown);
    target.addEventListener('pointermove', this.pointerMove);
    target.addEventListener('pointerup', this.pointerUp);
    target.addEventListener('pointercancel', this.pointerUp);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private keyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashQueued = true;
    if (e.code === 'Enter' || e.code === 'Space') this.onPrimary();
    if (e.code === 'ArrowUp' || e.code === 'KeyW') this.onMenu(-1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') this.onMenu(1);
    if (e.code === 'KeyP' || e.code === 'Escape') this.onPause();
    if (e.code === 'KeyM') this.onMute();
  };

  dashButton(): { x: number; y: number; r: number } {
    const rect = this.target.getBoundingClientRect();
    return { x: rect.width - 58, y: rect.height - 74, r: 44 };
  }

  private pointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    // Cancelling the press also cancels focus, and an embedded game needs focus for the keyboard.
    window.focus();
    if (e.pointerType === 'touch') this.usingTouch = true;
    const rect = this.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.onTap(x, y);
    this.onPrimary();
    const dash = this.dashButton();
    if (this.canDash() && Math.hypot(x - dash.x, y - dash.y) < dash.r) {
      this.dashQueued = true;
      return;
    }
    if (this.stickId === null) {
      this.stickId = e.pointerId;
      this.target.setPointerCapture(e.pointerId);
      Object.assign(this.stick, { active: true, originX: x, originY: y, x, y });
    }
  };

  private pointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    const rect = this.target.getBoundingClientRect();
    this.stick.x = e.clientX - rect.left;
    this.stick.y = e.clientY - rect.top;
  };

  private pointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.stick.active = false;
  };

  read(): Input {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) moveX -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) moveY -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) moveY += 1;
    let push = keysToScreen(moveX, moveY);
    if (this.stick.active) {
      const dx = this.stick.x - this.stick.originX;
      const dy = this.stick.y - this.stick.originY;
      const len = Math.hypot(dx, dy);
      if (len > 7) {
        const pull = Math.min(1, len / STICK_RANGE);
        push = { x: (dx / len) * Math.max(0.55, pull), y: (dy / len) * Math.max(0.55, pull) };
      }
    }
    const dash = this.dashQueued;
    this.dashQueued = false;
    // The sim only ever sees world directions.
    const world = screenDirToWorld(push.x, push.y);
    return { moveX: world.x, moveY: world.y, dash };
  }
}
