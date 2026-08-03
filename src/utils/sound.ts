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
   * Bunyi Alarm Masuk (Loud Warning Chime - 08:30 Pagi)
   * Menggunakan gelombang Triangle & Square untuk suara keras & lantang
   */
  public playCheckInSound() {
    this.enableAudio();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Melodi nada dering peringatan masuk (Keras & Jelas)
    const tones = [
      { freq: 587.33, type: "triangle", time: 0.00, duration: 0.18 }, // D5
      { freq: 739.99, type: "triangle", time: 0.20, duration: 0.18 }, // F#5
      { freq: 880.00, type: "square",   time: 0.40, duration: 0.40 }, // A5 (Loud!)
      
      { freq: 587.33, type: "triangle", time: 0.90, duration: 0.18 },
      { freq: 739.99, type: "triangle", time: 1.10, duration: 0.18 },
      { freq: 880.00, type: "square",   time: 1.30, duration: 0.40 },
      
      { freq: 880.00, type: "square",   time: 1.80, duration: 0.20 },
      { freq: 987.77, type: "square",   time: 2.05, duration: 0.20 },
      { freq: 1174.66,type: "square",   time: 2.30, duration: 0.60 }, // D6 High siren
    ];

    tones.forEach(({ freq, type, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq, now + time);

      // Volume maksimal (0.85) agar terdengar nyaring
      gain.gain.setValueAtTime(0.85, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });
  }

  /**
   * Bunyi Alarm Pulang (Loud Celebration Bell - 17:00 Sore)
   */
  public playCheckOutSound() {
    this.enableAudio();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Melodi nada dering jam pulang kantor
    const tones = [
      { freq: 523.25, type: "sine", time: 0.00, duration: 0.25 }, // C5
      { freq: 659.25, type: "sine", time: 0.25, duration: 0.25 }, // E5
      { freq: 783.99, type: "sine", time: 0.50, duration: 0.25 }, // G5
      { freq: 1046.50,type: "triangle", time: 0.75, duration: 0.60 }, // C6

      { freq: 659.25, type: "sine", time: 1.50, duration: 0.25 },
      { freq: 783.99, type: "sine", time: 1.75, duration: 0.25 },
      { freq: 1046.50,type: "triangle", time: 2.00, duration: 0.25 },
      { freq: 1318.51,type: "square",   time: 2.25, duration: 0.70 }, // E6 High bell
    ];

    tones.forEach(({ freq, type, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.9, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });
  }

  /**
   * Mulai loop nada dering alarm berkala sampai dimatikan
   */
  public startAlarmLoop(type: "in" | "out") {
    this.stopAlarmLoop();
    if (type === "in") {
      this.playCheckInSound();
      this.activeInterval = window.setInterval(() => this.playCheckInSound(), 4000);
    } else {
      this.playCheckOutSound();
      this.activeInterval = window.setInterval(() => this.playCheckOutSound(), 4000);
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
