export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const MAX_PARTICLES = 140;

export class Effects {
  particles: Particle[] = [];
  popups: Popup[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  // Seconds the simulation stays frozen. Only main.ts acts on it, so a replay never sees it.
  hitstop = 0;
  banner = '';
  bannerT = 0;

  burst(x: number, y: number, color: string, count: number, speed = 60): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const pace = speed * (0.4 + Math.random() * 0.8);
      const life = 0.3 + Math.random() * 0.35;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life, maxLife: life, color,
        size: Math.random() < 0.5 ? 1 : 2,
      });
    }
  }

  popup(x: number, y: number, text: string, color: string): void {
    if (this.popups.length > 8) this.popups.shift();
    this.popups.push({ x, y, text, color, life: 0.95 });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.93;
      p.vy *= 0.93;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const popup = this.popups[i] as Popup;
      popup.life -= dt;
      popup.y -= 22 * dt;
      if (popup.life <= 0) this.popups.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 5);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
  }

  clear(): void {
    this.particles.length = 0;
    this.popups.length = 0;
    this.shake = 0;
    this.flash = 0;
    this.hitstop = 0;
    this.bannerT = 0;
  }
}
