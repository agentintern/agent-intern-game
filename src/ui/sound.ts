// All sound is synthesized here. There are no audio files in this game.
type Wave = OscillatorType;

const BASS = [55, 55, 65.41, 55, 73.42, 73.42, 65.41, 49];
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 349.23];
const COMBO_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private playing = false;
  private tempo = 132;
  muted = false;
  chased = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
  }

  private tone(freq: number, length: number, wave: Wave, volume: number, at = 0, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const start = (at || this.ctx.currentTime) + 0.001;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + length);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  startMusic(): void {
    if (!this.ctx) return;
    this.playing = true;
    this.tempo = 132;
    this.beat = 0;
    this.nextBeat = this.ctx.currentTime + 0.1;
  }

  stopMusic(): void {
    this.playing = false;
  }

  rush(): void {
    this.tempo = 172;
  }

  // Called once per frame. Schedules a little ahead so the music doesn't drift with the frame rate.
  update(): void {
    if (!this.ctx || !this.playing) return;
    const eighth = 30 / (this.chased ? this.tempo * 1.2 : this.tempo);
    while (this.nextBeat < this.ctx.currentTime + 0.12) {
      const b = this.beat;
      if (b % 2 === 0) this.tone(BASS[(b / 2) % BASS.length] as number, eighth * 1.6, 'triangle', 0.55, this.nextBeat);
      this.tone(ARP[b % ARP.length] as number, eighth * 0.7, 'square', 0.06, this.nextBeat);
      if (b % 4 === 2) this.tone(1800, 0.03, 'square', 0.05, this.nextBeat);
      if (this.chased && b % 2 === 1) this.tone(110, eighth * 0.8, 'sawtooth', 0.2, this.nextBeat, 70);
      this.nextBeat += eighth;
      this.beat = (b + 1) % 32;
    }
  }

  task(combo: number): void {
    const note = COMBO_NOTES[Math.min(combo, COMBO_NOTES.length) - 1] ?? 523.25;
    const now = this.ctx?.currentTime ?? 0;
    this.tone(note, 0.09, 'square', 0.25);
    this.tone(note * 1.5, 0.14, 'square', 0.22, now + 0.07);
    if (combo >= 4) this.tone(note * 2, 0.2, 'triangle', 0.26, now + 0.14);
  }
  tick(): void { this.tone(900, 0.03, 'square', 0.07); }
  coffee(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.tone(180, 0.1, 'triangle', 0.4, 0, 90);
    this.tone(220, 0.1, 'triangle', 0.4, now + 0.1, 110);
    [659.25, 880, 1318.5].forEach((n, i) => this.tone(n, 0.16, 'square', 0.16, now + 0.22 + i * 0.07));
  }
  power(): void { this.tone(392, 0.3, 'triangle', 0.3, 0, 1174); }
  dash(): void { this.tone(620, 0.12, 'triangle', 0.3, 0, 160); }
  nearMiss(): void { this.tone(1200, 0.08, 'triangle', 0.25, 0, 1800); }
  missed(): void { this.tone(200, 0.2, 'square', 0.14, 0, 120); }
  meeting(): void {
    this.tone(330, 0.3, 'sawtooth', 0.26, 0, 90);
  }
  alert(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.tone(880, 0.09, 'square', 0.3);
    this.tone(1175, 0.14, 'square', 0.3, now + 0.1);
  }
  caught(): void { this.tone(160, 0.5, 'sawtooth', 0.45, 0, 50); }
  over(won: boolean): void {
    const now = this.ctx?.currentTime ?? 0;
    const notes = won ? [392, 523, 659, 784] : [392, 330, 262, 196];
    if (won) this.tone(1760, 1.4, 'sine', 0.3);
    notes.forEach((n, i) => this.tone(n, 0.24, 'square', 0.22, now + i * 0.14));
  }
}
