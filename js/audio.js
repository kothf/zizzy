'use strict';
/* =============================================================================
   Zizzy — 1-bit style beeper sound, synthesised with the Web Audio API.
   The audio context is created on the first key press or tap (browser rule).
   ============================================================================= */
class Beeper {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('zizzy-muted') === '1'; } catch (e) { /* storage blocked */ }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.11;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('zizzy-muted', this.muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    return this.muted;
  }

  tone(freq, dur, { type = 'square', to = null, at = 0, vol = 1 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + Math.max(0, dur - 0.01));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 1, at = 0, lowpass = 4000 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + at, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = lowpass; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t);
  }

  jump() { this.tone(220, 0.12, { to: 660 }); }
  land() { this.tone(110, 0.03, { to: 60 }); }
  pickup() { this.tone(660, 0.06); this.tone(990, 0.08, { at: 0.06 }); }
  drop() { this.tone(440, 0.05, { to: 220 }); }
  spark() { [880, 1175, 1480, 1760].forEach((f, i) => this.tone(f, 0.05, { at: i * 0.045 })); }
  solve() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.09, { at: i * 0.08 })); }
  clank() { this.tone(180, 0.05, { to: 90 }); this.tone(140, 0.05, { at: 0.07, to: 70 }); }
  hiss() { this.noise(0.5, { vol: 0.8, lowpass: 6000 }); }
  zap() { this.noise(0.25, { vol: 1, lowpass: 9000 }); this.tone(60, 0.25, { type: 'sawtooth' }); }
  fizz() { this.noise(0.4, { vol: 0.9, lowpass: 2500 }); this.tone(900, 0.4, { to: 80 }); }
  hurt() { this.tone(500, 0.45, { type: 'sawtooth', to: 50 }); }
  beep() { this.tone(1200, 0.04); this.tone(1600, 0.04, { at: 0.06 }); }
  blip() { this.tone(760 + Math.random() * 160, 0.012, { vol: 0.6 }); }

  /** "The wireless sings again" — an original 16-bar jingle. */
  victory() {
    const C5 = 523, D5 = 587, E5 = 659, F5 = 698, G5 = 784, A5 = 880, B5 = 988, C6 = 1047, G4 = 392;
    const tune = [[C5, 1], [E5, 1], [G5, 1], [C6, 2], [B5, 1], [G5, 1], [A5, 2], [F5, 1], [A5, 1], [G5, 2],
      [E5, 1], [G5, 1], [F5, 1], [D5, 1], [E5, 1], [C5, 1], [D5, 2], [G4, 1], [C5, 3]];
    let at = 0;
    for (const [f, len] of tune) { this.tone(f, len * 0.13 - 0.02, { at }); at += len * 0.13; }
  }
}
