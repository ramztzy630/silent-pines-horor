export class HorrorAudioEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;
    this.stepTimer = 0;
  }

  init() {
    if (this.isInitialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.isInitialized = true;

    this.startAmbientDrone();
    this.startRandomForestSounds();
  }

  // Suara drone rendah & angin hutan
  startAmbientDrone() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.value = 42; // Frekuensi sub-bass mencekam
    osc2.frequency.value = 43.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 130;

    gain.gain.value = 0.14;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
  }

  // Klik tombol senter mekanis
  playFlashlightClick(isOn) {
    if (!this.isInitialized) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(isOn ? 1400 : 950, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Suara langkah kaki di dedaunan kering
  playFootstep(isCrouching) {
    if (!this.isInitialized) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.09;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isCrouching ? 600 : 1100;

    const gain = this.ctx.createGain();
    gain.gain.value = isCrouching ? 0.06 : 0.18;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Efek suara ranting patah / geraman acak di kejauhan
  startRandomForestSounds() {
    setInterval(() => {
      if (!this.isInitialized || Math.random() > 0.45) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Suara burung hantu / bisikan frekuensi rendah
      osc.type = 'sine';
      const baseFreq = Math.random() > 0.5 ? 290 : 95;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + 1.4);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.55);
    }, 6500);
  }
}
