// ─── UTILS NADA DERING & ALARM SUARA (WEB AUDIO API) ───

class SoundService {
  private audioCtx: AudioContext | null = null;
  private activeInterval: number | null = null;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public enableAudio() {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {
      console.error("Gagal inisialisasi audio context:", e);
    }
  }

  /**
   * Bunyi Alarm Masuk (Loud Attention Siren & Upbeat Alert - 08:30 Pagi)
   * Menggunakan kombinasi Sawtooth + Square Wave + Frequency Sweep agar sangat nyaring & berisik
   */
  public playCheckInSound() {
    this.enableAudio();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // 1. Sirene Sweeping (600Hz -> 1400Hz) - Efek Perhatian Berisik
    try {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(600, now);
      osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
      gain1.gain.setValueAtTime(0.95, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(700, now + 0.3);
      osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.55);
      gain2.gain.setValueAtTime(0.95, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.58);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 0.58);
    } catch (e) {}

    // 2. Melodi Alarm Pagi Energetik (E5, G#5, B5, E6)
    const tones = [
      { freq: 659.25, type: "sawtooth", time: 0.65, duration: 0.15 }, // E5
      { freq: 830.61, type: "sawtooth", time: 0.82, duration: 0.15 }, // G#5
      { freq: 987.77, type: "square",   time: 0.99, duration: 0.20 }, // B5
      { freq: 1318.51,type: "square",   time: 1.22, duration: 0.50 }, // E6 High Siren

      { freq: 987.77, type: "sawtooth", time: 1.80, duration: 0.15 }, // B5
      { freq: 1318.51,type: "square",   time: 1.98, duration: 0.55 }, // E6 Power
    ];

    tones.forEach(({ freq, type, time, duration }) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type as OscillatorType;
        osc.frequency.setValueAtTime(freq, now + time);

        // Volume maksimal (0.95) agar sangat berisik & tidak terlewatkan
        gain.gain.setValueAtTime(0.95, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      } catch (e) {}
    });
  }

  /**
   * Bunyi Alarm Pulang (Victory Energetic Celebration Trumpet - 17:00 Sore)
   * Menggunakan arpeggio terompet cepat & nada tinggi gembira bebas jam kerja
   */
  public playCheckOutSound() {
    this.enableAudio();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const tones = [
      // Fast Ascending Arpeggio (C5 -> E5 -> G5 -> C6)
      { freq: 523.25, type: "sawtooth", time: 0.00, duration: 0.14 }, // C5
      { freq: 659.25, type: "sawtooth", time: 0.14, duration: 0.14 }, // E5
      { freq: 783.99, type: "sawtooth", time: 0.28, duration: 0.14 }, // G5
      { freq: 1046.50,type: "square",   time: 0.42, duration: 0.35 }, // C6

      // Victory Bounce (G5 -> C6 -> E6 -> G6)
      { freq: 783.99, type: "sawtooth", time: 0.85, duration: 0.12 }, // G5
      { freq: 1046.50,type: "sawtooth", time: 0.99, duration: 0.12 }, // C6
      { freq: 1318.51,type: "square",   time: 1.13, duration: 0.15 }, // E6
      { freq: 1567.98,type: "square",   time: 1.30, duration: 0.60 }, // G6 High Victory!

      // Final Power Finish Stabs
      { freq: 1046.50, type: "square",  time: 2.00, duration: 0.18 }, // C6
      { freq: 1318.51, type: "square",  time: 2.22, duration: 0.18 }, // E6
      { freq: 1567.98, type: "square",  time: 2.44, duration: 0.65 }, // G6 Finale!
    ];

    tones.forEach(({ freq, type, time, duration }) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type as OscillatorType;
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.95, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      } catch (e) {}
    });
  }

  /**
   * Mulai loop nada dering alarm berkala sampai dimatikan
   */
  public startAlarmLoop(type: "in" | "out") {
    this.stopAlarmLoop();
    if (type === "in") {
      this.playCheckInSound();
      this.activeInterval = window.setInterval(() => this.playCheckInSound(), 3200);
    } else {
      this.playCheckOutSound();
      this.activeInterval = window.setInterval(() => this.playCheckOutSound(), 3200);
    }
  }

  /**
   * Hentikan nada dering
   */
  public stopAlarmLoop() {
    if (this.activeInterval !== null) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }
}

export const soundService = new SoundService();
