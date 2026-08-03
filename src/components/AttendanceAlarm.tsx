import { useState, useEffect, useRef } from "react";
import { BellRing, Volume2, VolumeX, CheckCircle2, Clock, X, AlertTriangle } from "lucide-react";
import { AttendanceRecord, Employee } from "../types";
import { getTodayStr, getServerTime } from "../utils";
import { soundService } from "../utils/sound";

interface AttendanceAlarmProps {
  employee: Employee;
  todayRecord?: AttendanceRecord;
  onGoToScan: () => void;
}

export function AttendanceAlarm({ employee, todayRecord, onGoToScan }: AttendanceAlarmProps) {
  const [activeAlarm, setActiveAlarm] = useState<"in" | "out" | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [testingSound, setTestingSound] = useState<"in" | "out" | null>(null);
  const hasTriggeredRef = useRef<{ inDate?: string; outDate?: string }>({});

  useEffect(() => {
    // Enable Web Audio pada interaksi pengguna pertama kali
    const handleFirstInteraction = () => {
      soundService.enableAudio();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, []);

  // Timer pengecekan setiap 5 detik untuk alarm otomatis
  useEffect(() => {
    const checkAlarmTime = () => {
      const now = getServerTime();
      const todayStr = getTodayStr();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMins = hours * 60 + minutes;

      const isSaturday = now.getDay() === 6;

      // ─── 1. ALARM ABSEN MASUK (08:30 WIB s/d 09:00 WIB) ───
      // Mulai muncul jam 08:30 pagi jika karyawan belum absen masuk
      const ALARM_IN_START = 8 * 60 + 30; // 08:30
      const ALARM_IN_END = 9 * 60 + 15;   // 09:15

      if (!todayRecord && totalMins >= ALARM_IN_START && totalMins <= ALARM_IN_END) {
        const dismissedKey = `fast-absen-dismissed-in-${todayStr}-${employee.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);

        if (!isDismissed && hasTriggeredRef.current.inDate !== todayStr) {
          hasTriggeredRef.current.inDate = todayStr;
          setActiveAlarm("in");
          if (!soundMuted) {
            soundService.startAlarmLoop("in");
          }
          return;
        }
      }

      // ─── 2. ALARM ABSEN PULANG (17:00 WIB / Sabtu 12:00 WIB) ───
      // Mulai muncul jam 17:00 sore (Sabtu 12:00) jika sudah absen masuk & belum check out
      const ALARM_OUT_START = isSaturday ? 12 * 60 : 17 * 60; // 17:00 (Sabtu 12:00)
      const ALARM_OUT_END = isSaturday ? 13 * 60 : 18 * 60;   // 18:00 (Sabtu 13:00)

      if (todayRecord && todayRecord.checkIn && !todayRecord.checkOut && totalMins >= ALARM_OUT_START && totalMins <= ALARM_OUT_END) {
        const dismissedKey = `fast-absen-dismissed-out-${todayStr}-${employee.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);

        if (!isDismissed && hasTriggeredRef.current.outDate !== todayStr) {
          hasTriggeredRef.current.outDate = todayStr;
          setActiveAlarm("out");
          if (!soundMuted) {
            soundService.startAlarmLoop("out");
          }
          return;
        }
      }
    };

    checkAlarmTime();
    const interval = setInterval(checkAlarmTime, 5000);
    return () => clearInterval(interval);
  }, [todayRecord, employee.id, soundMuted]);

  const handleDismiss = () => {
    const todayStr = getTodayStr();
    if (activeAlarm === "in") {
      localStorage.setItem(`fast-absen-dismissed-in-${todayStr}-${employee.id}`, "true");
    } else if (activeAlarm === "out") {
      localStorage.setItem(`fast-absen-dismissed-out-${todayStr}-${employee.id}`, "true");
    }
    soundService.stopAlarmLoop();
    setActiveAlarm(null);
  };

  const handleAction = () => {
    handleDismiss();
    onGoToScan();
  };

  const handleTestSound = (type: "in" | "out") => {
    soundService.enableAudio();
    if (testingSound === type) {
      soundService.stopAlarmLoop();
      setTestingSound(null);
    } else {
      setTestingSound(type);
      soundService.startAlarmLoop(type);
      setTimeout(() => {
        soundService.stopAlarmLoop();
        setTestingSound(null);
      }, 5000);
    }
  };

  return (
    <>
      {/* Tombol Uji Coba Suara Alarm di UI (Widget Bawah Header) */}
      <div className="bg-card border border-border rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 my-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Alarm Pengingat Otomatis Active
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            </p>
            <p className="text-[11px] text-muted-foreground">
              Masuk: <strong className="text-foreground">08:30 WIB</strong> · Pulang: <strong className="text-foreground">17:00 WIB</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleTestSound("in")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
              testingSound === "in"
                ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                : "bg-muted text-foreground border-border hover:bg-muted/80"
            }`}
            title="Tes Suara Alarm Absen Masuk (08:30)"
          >
            <Volume2 className="w-3.5 h-3.5" />
            {testingSound === "in" ? "Bunyi Alarm Masuk..." : "Tes Alarm Masuk"}
          </button>

          <button
            onClick={() => handleTestSound("out")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
              testingSound === "out"
                ? "bg-emerald-600 text-white border-emerald-700 animate-pulse"
                : "bg-muted text-foreground border-border hover:bg-muted/80"
            }`}
            title="Tes Suara Alarm Absen Pulang (17:00)"
          >
            <Volume2 className="w-3.5 h-3.5" />
            {testingSound === "out" ? "Bunyi Alarm Pulang..." : "Tes Alarm Pulang"}
          </button>
        </div>
      </div>

      {/* ─── MODAL ALARM NYARING SAAT JAM TERSEBUT TIBA ─── */}
      {activeAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-card border-4 border-amber-500 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center relative overflow-hidden animate-in zoom-in duration-300">
            {/* Background Glow */}
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />

            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/40 animate-bounce">
              <BellRing className="w-10 h-10" />
            </div>

            {activeAlarm === "in" ? (
              <>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2 inline-block">
                  ⏰ Peringatan Absen Masuk!
                </span>
                <h2 className="text-2xl font-black text-foreground mb-2">Sudah Jam 08:30 WIB!</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Halo <strong className="text-foreground">{employee.name}</strong>, jangan lupa segera lakukan <strong>Absen Masuk</strong> sebelum batas jam 09:00 WIB agar tidak terlambat!
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAction}
                    className="w-full bg-amber-500 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Absen Masuk Sekarang
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full bg-muted text-muted-foreground py-2.5 rounded-xl font-semibold text-xs hover:bg-muted/80 transition-colors"
                  >
                    Matikan Alarm (Nanti Saja)
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2 inline-block">
                  🔔 Peringatan Absen Pulang!
                </span>
                <h2 className="text-2xl font-black text-foreground mb-2">Sudah Jam 17:00 WIB!</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Waktu kerja hari ini telah selesai! Halo <strong className="text-foreground">{employee.name}</strong>, silakan lakukan <strong>Absen Pulang</strong> sekarang sebelum pulang ke rumah.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAction}
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-bold text-base hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Absen Pulang Sekarang
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full bg-muted text-muted-foreground py-2.5 rounded-xl font-semibold text-xs hover:bg-muted/80 transition-colors"
                  >
                    Matikan Alarm (Nanti Saja)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
