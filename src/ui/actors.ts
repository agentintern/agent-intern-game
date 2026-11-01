import { box, lit, onLeft } from './box';
import type { View4 } from './iso';
import { worldToScreen } from './iso';

// People are built from small boxes in real space, so all four views, the walk and the dash come from one model.
// f runs forward from the character, s to its right, z up.
type Art = CanvasRenderingContext2D;

interface Part {
  f: number;
  s: number;
  z: number;
  lf: number;
  ls: number;
  h: number;
  color: string;
  glow?: string;
  rim?: number;
  // Stuck on the front of the body, in layers: a visor, then the eyes on it. Hidden when seen from behind.
  decal?: number;
}

export interface Pose {
  view: View4;
  // 0 to 1 through a stride, or -1 standing.
  stride: number;
  dash: boolean;
  // Out of energy: bent forward, arms hanging, eyes low.
  tired: boolean;
  stunned: boolean;
}

const AXES: Record<View4, { fx: number; fy: number; rx: number; ry: number }> = {
  se: { fx: 1, fy: 0, rx: 0, ry: 1 },
  sw: { fx: 0, fy: 1, rx: -1, ry: 0 },
  nw: { fx: -1, fy: 0, rx: 0, ry: -1 },
  ne: { fx: 0, fy: -1, rx: 1, ry: 0 },
};

// People stay brighter than the room, or they'd sink into the night.
function build(c: Art, view: View4, parts: Part[]): void {
  const a = AXES[view];
  const placed = parts.map((p) => {
    const alongX = a.fx !== 0;
    const w = alongX ? p.lf : p.ls;
    const d = alongX ? p.ls : p.lf;
    const cx = a.fx * p.f + a.rx * p.s;
    const cy = a.fy * p.f + a.ry * p.s;
    const facing = view === 'se' || view === 'sw' ? 30 : -30;
    return { p, x: cx - w / 2, y: cy - d / 2, w, d, key: cx + cy + p.z * 0.02 + (p.decal ? facing + p.decal * 5 : 0) };
  });
  placed.sort((m, n) => m.key - n.key);
  for (const { p, x, y, w, d } of placed) {
    if (p.glow) {
      c.shadowColor = p.glow;
      c.shadowBlur = 5 * c.getTransform().a;
    }
    box(c, x, y, p.z, w, d, p.h, lit(p.color), { rim: p.rim ?? 0.35, fall: 0.16 });
    c.shadowBlur = 0;
  }
}

export function drawRobot(c: Art, pose: Pose): void {
  const swing = pose.stride < 0 ? 0 : Math.sin(pose.stride * Math.PI * 2) * (pose.dash ? 4.4 : 3);
  const bob = pose.stride < 0 ? 0 : Math.abs(Math.sin(pose.stride * Math.PI * 2)) * 0.8;
  const lean = pose.dash ? 2.4 : pose.tired ? 1.6 : 0;
  const droop = pose.tired ? 1.5 : 0;
  const up = 8 + bob - droop * 0.4;
  const shirt = '#f7f1e4';
  const steel = '#c3ccd8';
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    const f = swing * side;
    const raise = Math.max(0, f) * 0.28;
    parts.push({ f: f + 0.6, s: side * 2.3, z: raise, lf: 4.8, ls: 2.7, h: 1.8, color: '#b4bcc9' });
    parts.push({ f, s: side * 2.3, z: raise + 1.8, lf: 2.5, ls: 2.7, h: up - 1.8 - raise, color: '#232a40', rim: 0.15 });
    const arm = (pose.tired ? 1 : -swing * side * (pose.dash ? 1.2 : 0.85)) + lean * 0.5;
    parts.push({ f: arm, s: side * 5.5, z: up + 5.6 - droop, lf: 2.9, ls: 2.5, h: 4.4, color: shirt, rim: 0.25 });
    parts.push({ f: arm, s: side * 5.5, z: up + 1.7 - droop, lf: 1.8, ls: 1.8, h: 3.9, color: '#aeb7c4', rim: 0.3 });
    parts.push({ f: arm, s: side * 5.5, z: up + 0.1 - droop, lf: 2.2, ls: 2.2, h: 1.6, color: steel });
  }
  const t = lean * 0.5;
  parts.push({ f: t, s: 0, z: up + 1.1, lf: 5.8, ls: 8.8, h: 9, color: shirt });
  parts.push({ f: t, s: 0, z: up, lf: 6, ls: 9, h: 1.2, color: '#14151e', rim: 0.1 });
  parts.push({ f: t + 3.02, s: 0, z: up + 2, lf: 0.34, ls: 2.2, h: 7.2, color: '#d9402f', rim: 0.1, decal: 1 });
  parts.push({ f: t + 3.08, s: 0, z: up + 8.2, lf: 0.5, ls: 2.8, h: 1.4, color: '#b02f22', rim: 0.1, decal: 2 });
  parts.push({ f: t + 3.2, s: 0, z: up + 3.2, lf: 0.3, ls: 3.2, h: 3.6, color: '#ffffff', rim: 0.1, decal: 3 });
  parts.push({ f: t + 3.26, s: 0, z: up + 5.6, lf: 0.2, ls: 2.6, h: 0.8, color: '#3f7fc4', rim: 0, decal: 4 });
  parts.push({ f: t + 3.2, s: 0, z: up + 3.2 + 3.6, lf: 0.2, ls: 0.5, h: 1.6, color: '#1c1a26', rim: 0, decal: 3 });
  parts.push({ f: t, s: 0, z: up + 10, lf: 3.8, ls: 4.2, h: 1.4, color: '#5d6878' });
  const hz = up + 11.2 - droop;
  const hf = lean + (pose.tired ? 0.8 : 0);
  parts.push({ f: hf, s: 0, z: hz, lf: 10.4, ls: 11.6, h: 10.4, color: steel, rim: 0.7 });
  parts.push({ f: hf - 1, s: 0, z: hz + 10.4, lf: 3, ls: 5.4, h: 0.4, color: '#2b2e38', rim: 0.1 });
  parts.push({ f: hf, s: 6.2, z: hz + 3.2, lf: 4.6, ls: 1, h: 4.2, color: '#7c8797' });
  parts.push({ f: hf, s: -6.2, z: hz + 3.2, lf: 4.6, ls: 1, h: 4.2, color: '#7c8797' });
  parts.push({ f: hf + 5.3, s: 0, z: hz + 3.2, lf: 0.5, ls: 10.4, h: 5.2, color: '#0e0f16', rim: 0.25, decal: 1 });
  const eye = pose.stunned ? '#6d7482' : '#ffa04a';
  const eyeH = pose.tired ? 0.9 : 2.1;
  const eyeZ = pose.tired ? hz + 5 : hz + 4.7;
  for (const side of [-1, 1]) {
    parts.push({ f: hf + 5.66, s: side * 2.6, z: eyeZ, lf: 0.16, ls: 3, h: eyeH, color: eye, glow: pose.stunned ? undefined : '#ff8a2d', rim: 0, decal: 2 });
  }
  for (const z of [0.9, 1.8]) parts.push({ f: hf + 5.25, s: 0, z: hz + z, lf: 0.2, ls: 4.4, h: 0.4, color: '#5d6878', rim: 0, decal: 1 });
  build(c, pose.view, parts);
}

export function drawBossFigure(c: Art, pose: Pose): void {
  const swing = pose.stride < 0 ? 0 : Math.sin(pose.stride * Math.PI * 2) * 2.8;
  const bob = pose.stride < 0 ? 0 : Math.abs(Math.sin(pose.stride * Math.PI * 2)) * 0.6;
  const suit = '#737b8c';
  const dark = '#4a505c';
  const skin = '#f2c29b';
  const up = 8.6 + bob;
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    const f = swing * side;
    parts.push({ f: f + 0.8, s: side * 2.7, z: 0, lf: 5.4, ls: 3, h: 1.7, color: '#191a22' });
    parts.push({ f, s: side * 2.7, z: 1.7, lf: 3, ls: 3.2, h: up - 1.7, color: dark, rim: 0.15 });
    parts.push({ f: -f * 0.8, s: side * 6.7, z: up + 2.4, lf: 3, ls: 2.7, h: 8.2, color: suit, rim: 0.25 });
    parts.push({ f: -f * 0.8, s: side * 6.7, z: up + 1, lf: 2.3, ls: 2.3, h: 1.5, color: skin });
  }
  parts.push({ f: 0.3, s: 0, z: up, lf: 7.4, ls: 11.2, h: 11.4, color: suit });
  parts.push({ f: 4.08, s: 0, z: up + 7, lf: 0.3, ls: 3.8, h: 4.2, color: '#f5edd8', rim: 0, decal: 1 });
  parts.push({ f: 4.2, s: 0, z: up + 2, lf: 0.34, ls: 2, h: 8.6, color: '#7a2230', rim: 0.1, decal: 1 });
  parts.push({ f: 4.1, s: -3.6, z: up + 8, lf: 0.2, ls: 1.5, h: 1, color: '#d9402f', rim: 0, decal: 1 });
  const hz = up + 11.4;
  parts.push({ f: 0.2, s: 0, z: up + 11.2, lf: 4, ls: 4.6, h: 1, color: skin });
  parts.push({ f: 0.3, s: 0, z: hz + 0.6, lf: 9, ls: 9.8, h: 8.8, color: skin, rim: 0.4 });
  parts.push({ f: 0.3, s: 0, z: hz + 7.6, lf: 9.6, ls: 10.4, h: 3.2, color: '#3d4250', rim: 0.5 });
  parts.push({ f: -3.6, s: 0, z: hz + 3, lf: 2.4, ls: 10.4, h: 5, color: '#3d4250', rim: 0.3 });
  for (const side of [-1, 1]) {
    parts.push({ f: 4.92, s: side * 2.4, z: hz + 5.4, lf: 0.16, ls: 2.2, h: 1.3, color: '#191a22', rim: 0, decal: 1 });
    parts.push({ f: 4.94, s: side * 2.4, z: hz + 7, lf: 0.2, ls: 2.9, h: 0.7, color: '#2b2e38', rim: 0, decal: 1 });
  }
  parts.push({ f: 4.92, s: 0, z: hz + 2.4, lf: 0.16, ls: 4.2, h: 0.8, color: '#7a4a38', rim: 0, decal: 1 });
  build(c, pose.view, parts);
}

// An angry calendar invite. It hovers, and the staple is what pins it down.
export function drawInvite(c: Art, frame: number, frozen: boolean): void {
  const lift = frozen ? 2 : 8 + frame * 1.6;
  const W = 15;
  const H = 15;
  const paper = frozen ? '#b9d4ee' : '#f5edd8';
  const head = frozen ? '#5f93c4' : '#d9402f';
  box(c, -W / 2, -1, lift, W, 2, H, lit(paper), { rim: 0.6, fall: 0.1 });
  box(c, -W / 2, -1, lift + H - 4, W, 2, 4, lit(head), { rim: 0.5, fall: 0 });
  for (const x of [-4.2, 4.2]) box(c, x - 0.6, -0.6, lift + H - 0.4, 1.2, 1.2, 1.7, lit('#c3ccd8'), { rim: 0.4 });
  onLeft(c, 1, () => {
    c.fillStyle = '#1c1a26';
    const L = lift;
    c.save();
    c.translate(0, -L);
    c.beginPath();
    c.moveTo(-5.4, -9.4); c.lineTo(-1.6, -8); c.lineTo(-2, -7); c.lineTo(-5.6, -8.4); c.closePath();
    c.moveTo(5.4, -9.4); c.lineTo(1.6, -8); c.lineTo(2, -7); c.lineTo(5.6, -8.4); c.closePath();
    c.fill();
    c.fillRect(-4.2, -7, 1.6, 1.6);
    c.fillRect(2.6, -7, 1.6, 1.6);
    c.lineWidth = 0.8;
    c.strokeStyle = '#1c1a26';
    c.beginPath();
    c.moveTo(-3, -2.6);
    c.quadraticCurveTo(0, -5, 3, -2.6);
    c.stroke();
    c.restore();
  });
  if (frozen) {
    const a = worldToScreen(-8.6, 1.6, lift + 6.5);
    const b = worldToScreen(8.6, 1.6, lift + 6.5);
    const steel = '#eef2f7';
    c.lineCap = 'round';
    c.lineWidth = 1.5;
    c.strokeStyle = '#30343f';
    c.beginPath();
    c.moveTo(a.x, a.y + 8.6); c.lineTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(b.x, b.y + 8.6);
    c.stroke();
    c.lineWidth = 0.8;
    c.strokeStyle = steel;
    c.stroke();
  }
}
