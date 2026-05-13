export class FireAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private popTimeout: ReturnType<typeof setTimeout> | null = null;
  private _muted = true;
  private _health = 1;

  private buildNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const size = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < size; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
    }
    return buf;
  }

  private startNoise(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.buildNoiseBuffer();
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;

    src.connect(lp);
    lp.connect(hp);
    hp.connect(this.masterGain!);
    src.start();
    this.noiseSource = src;
  }

  private scheduleNextPop(): void {
    if (this._muted || !this.ctx) return;
    const interval = 300 + (1 - this._health) * 1700;
    this.popTimeout = setTimeout(() => {
      this.firePop();
      this.scheduleNextPop();
    }, interval);
  }

  private firePop(): void {
    if (!this.ctx || this._muted) return;
    const ctx = this.ctx;
    const freq = 800 + Math.random() * 2200;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.frequency.value = freq;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0.15 * this._health, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);
    this.startNoise();
  }

  unmute(): void {
    if (!this.ctx) this.init();
    this._muted = false;
    this.ctx?.resume();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.18 * this._health, this.ctx.currentTime + 1);
    }
    this.scheduleNextPop();
  }

  mute(): void {
    this._muted = true;
    if (this.popTimeout) clearTimeout(this.popTimeout);
    this.ctx?.suspend();
  }

  setHealth(health: number): void {
    this._health = health;
    if (!this._muted && this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0.18 * health, this.ctx.currentTime + 2);
    }
  }

  destroy(): void {
    if (this.popTimeout) clearTimeout(this.popTimeout);
    try { this.noiseSource?.stop(); } catch {}
    try { this.ctx?.close(); } catch {}
  }

  get isMuted(): boolean { return this._muted; }
}
