// VOIDBLOOM — synthesized sound.
// No audio files: every effect is an oscillator or a noise burst shaped by
// an envelope, and the music is a slow two-oscillator pad that follows the
// game's intensity. The context is created lazily on the first user gesture,
// as browsers require, and M toggles a master mute.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
    this.lastPlay = new Map(); // effect name -> last start time (throttling)
  }

  // Must be called from a click or key handler at least once.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // One enveloped oscillator blip. `slide` bends the pitch across the note.
  tone({ freq = 440, slide = 0, type = 'sine', dur = 0.12, vol = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered white noise, for explosions and dash whooshes.
  noise({ dur = 0.25, vol = 0.25, freq = 900, delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * dur));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  // Named effects, throttled so a busy frame cannot stack fifty of them.
  play(name) {
    if (!this.context || this.muted) return;
    const now = performance.now();
    const throttle = { shoot: 45, hit: 30, pickup: 40 }[name] ?? 0;
    if (throttle && now - (this.lastPlay.get(name) ?? 0) < throttle) return;
    this.lastPlay.set(name, now);
    switch (name) {
      case 'shoot':
        this.tone({ freq: 880, slide: -420, type: 'square', dur: 0.07, vol: 0.05 });
        break;
      case 'hit':
        this.tone({ freq: 220, slide: -60, type: 'triangle', dur: 0.05, vol: 0.08 });
        break;
      case 'explode':
        this.noise({ dur: 0.28, vol: 0.22, freq: 1100 });
        this.tone({ freq: 130, slide: -70, type: 'sine', dur: 0.25, vol: 0.18 });
        break;
      case 'explodeBig':
        this.noise({ dur: 0.6, vol: 0.34, freq: 800 });
        this.tone({ freq: 82, slide: -40, type: 'sine', dur: 0.55, vol: 0.3 });
        break;
      case 'pickup':
        this.tone({ freq: 660, slide: 240, type: 'sine', dur: 0.08, vol: 0.07 });
        break;
      case 'hurt':
        this.tone({ freq: 160, slide: -80, type: 'sawtooth', dur: 0.18, vol: 0.16 });
        this.noise({ dur: 0.12, vol: 0.1, freq: 500 });
        break;
      case 'dash':
        this.noise({ dur: 0.16, vol: 0.1, freq: 2400 });
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((freq, i) => {
          this.tone({ freq, type: 'triangle', dur: 0.16, vol: 0.12, delay: i * 0.07 });
        });
        break;
      case 'choose':
        this.tone({ freq: 740, slide: 160, type: 'triangle', dur: 0.12, vol: 0.12 });
        break;
      case 'boss':
        [110, 110, 165, 110, 220].forEach((freq, i) => {
          this.tone({ freq, type: 'sawtooth', dur: 0.14, vol: 0.1, delay: i * 0.13 });
        });
        break;
      case 'victory':
        [392, 523, 659, 784, 1047, 1319].forEach((freq, i) => {
          this.tone({ freq, type: 'triangle', dur: 0.22, vol: 0.12, delay: i * 0.1 });
        });
        break;
      case 'gameover':
        [330, 262, 196, 131].forEach((freq, i) => {
          this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.14, delay: i * 0.16 });
        });
        break;
      default:
        break;
    }
  }

  // The ambient pad: two detuned triangles through a slow filter LFO.
  // Intensity (0..1) opens the filter and raises the gain a little.
  startPad() {
    if (!this.context || this.padNodes) return;
    const ctx = this.context;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const oscA = ctx.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.value = 110;
    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 164.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain).connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
    this.padNodes = { gain, filter };
  }

  setIntensity(intensity) {
    if (!this.padNodes || !this.context) return;
    const target = 300 + intensity * 700;
    this.padNodes.filter.frequency.setTargetAtTime(target, this.context.currentTime, 0.4);
    this.padNodes.gain.gain.setTargetAtTime(0.035 + intensity * 0.03, this.context.currentTime, 0.4);
  }
}
