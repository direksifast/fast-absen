// ─── UTILS NADA DERING & ALARM SUARA (WEB AUDIO API & SPEECH SYNTHESIS) ───

class SoundService {
  private audioCtx: AudioContext | null = null;
  private activeInterval: number | null = null;
  private speaking: boolean = false;

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

  private playToneSequence(tones: {freq: number, type: string, time: number, duration: number}[], onEnd?: () => void) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    let maxTime = 0;
    
    tones.forEach(({ freq, type, time, duration }) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type as OscillatorType;
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.5, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
        
        if (time + duration > maxTime) maxTime = time + duration;
      } catch (e) {}
    });

    if (onEnd) {
      setTimeout(onEnd, (maxTime + 0.1) * 1000);
    }
  }

  private speak(text: string, onEnd?: () => void) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    
    // Batalkan speech sebelumnya jika ada
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID"; // Bahasa Indonesia
    utterance.rate = 0.95; // Sedikit lebih lambat agar jelas
    utterance.pitch = 1.1; // Nada suara sedikit lebih tinggi/ceria
    
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    
    utterance.onerror = (e) => {
      console.error("Speech error:", e);
      if (onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Bunyi Alarm Masuk (Intro Jingle -> Suara -> Outro Jingle)
   */
  public playCheckInSound() {
    if (this.speaking) return;
    this.enableAudio();
    this.speaking = true;

    // Intro jingle (Upbeat ascending)
    const introTones = [
      { freq: 523.25, type: "sawtooth", time: 0.0, duration: 0.15 },
      { freq: 659.25, type: "sawtooth", time: 0.15, duration: 0.15 },
      { freq: 783.99, type: "sawtooth", time: 0.3, duration: 0.15 },
      { freq: 1046.50, type: "square",  time: 0.45, duration: 0.4 },
    ];
    
    // Outro jingle (Soft confirmation)
    const outroTones = [
      { freq: 1046.50, type: "square",  time: 0.0, duration: 0.15 },
      { freq: 1318.51, type: "square",  time: 0.15, duration: 0.4 },
    ];

    this.playToneSequence(introTones, () => {
      this.speak("Halo! Udah saatnya absen masuk nih. Silakan lakukan absen sekarang ya.", () => {
        this.playToneSequence(outroTones, () => {
          this.speaking = false;
        });
      });
    });
  }

  /**
   * Bunyi Alarm Pulang (Intro Jingle -> Suara -> Outro Jingle)
   */
  public playCheckOutSound() {
    if (this.speaking) return;
    this.enableAudio();
    this.speaking = true;

    // Intro jingle (Energetic victory)
    const introTones = [
      { freq: 783.99, type: "square", time: 0.0, duration: 0.15 },
      { freq: 1046.50, type: "square", time: 0.15, duration: 0.15 },
      { freq: 1318.51, type: "square", time: 0.3, duration: 0.15 },
      { freq: 1567.98, type: "square", time: 0.45, duration: 0.4 },
    ];

    // Outro jingle (Closing chime)
    const outroTones = [
      { freq: 1567.98, type: "square",  time: 0.0, duration: 0.15 },
      { freq: 1046.50, type: "square",  time: 0.15, duration: 0.4 },
    ];

    this.playToneSequence(introTones, () => {
      this.speak("Waktu kerja selesai! Udah saatnya absen pulang. Terima kasih atas kerja kerasnya hari ini.", () => {
        this.playToneSequence(outroTones, () => {
          this.speaking = false;
        });
      });
    });
  }

  /**
   * Mulai loop alarm berkala sampai dimatikan
   */
  public startAlarmLoop(type: "in" | "out") {
    this.stopAlarmLoop();
    
    // Trigger pertama kali
    if (type === "in") {
      this.playCheckInSound();
    } else {
      this.playCheckOutSound();
    }

    // Interval di set sedikit lebih lama (e.g. 10 detik) karena ada durasi bicara yang cukup panjang
    this.activeInterval = window.setInterval(() => {
      if (!this.speaking) {
        if (type === "in") this.playCheckInSound();
        else this.playCheckOutSound();
      }
    }, 10000);
  }

  /**
   * Hentikan nada dering dan suara
   */
  public stopAlarmLoop() {
    if (this.activeInterval !== null) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
  }
}

export const soundService = new SoundService();
