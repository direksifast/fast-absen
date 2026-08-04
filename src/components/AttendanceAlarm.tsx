import { useState, useEffect, useRef } from "react";
import { BellRing, Volume2, CheckCircle2, X, Smartphone, Bell } from "lucide-react";
import { AttendanceRecord, Employee } from "../types";
import { getTodayStr, getServerTime } from "../utils";
import { soundService } from "../utils/sound";
import { NotificationService } from "../utils/notification";
import { registerPushNotification } from "../utils/pushSubscription";

interface AttendanceAlarmProps {
  employee: Employee;
  todayRecord?: AttendanceRecord;
  onGoToScan: () => void;
}

export function AttendanceAlarm({ employee, todayRecord, onGoToScan }: AttendanceAlarmProps) {
  const [activeAlarm, setActiveAlarm] = useState<"in" | "out" | null>(null);
  const [testingSound, setTestingSound] = useState<"in" | "out" | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    NotificationService.getPermission()
  );
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

      // ─── 1. ALARM ABSEN MASUK (08:30 WIB s/d 09:15 WIB) ───
      const ALARM_IN_START = 8 * 60 + 30; // 08:30
      const ALARM_IN_END = 9 * 60 + 15;   // 09:15

      if (!todayRecord && totalMins >= ALARM_IN_START && totalMins <= ALARM_IN_END) {
        const dismissedKey = `fast-absen-dismissed-in-${todayStr}-${employee.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);

        if (!isDismissed && hasTriggeredRef.current.inDate !== todayStr) {
          hasTriggeredRef.current.inDate = todayStr;
          setActiveAlarm("in");
          soundService.startAlarmLoop("in");

          // Kirim Notifikasi Sistem ke Layar HP
          NotificationService.sendSystemNotification("⏰ Peringatan Absen Masuk!", {
            body: `Halo ${employee.name}, sudah jam 08:30 WIB! Segera lakukan absen masuk sebelum jam 09:00 WIB agar tidak terlambat.`,
          });
          return;
        }
      }

      // ─── 2. ALARM ABSEN PULANG (17:00 WIB / Sabtu 12:00 WIB) ───
      const ALARM_OUT_START = isSaturday ? 12 * 60 : 17 * 60; // 17:00 (Sabtu 12:00)
      const ALARM_OUT_END = isSaturday ? 13 * 60 : 18 * 60;   // 18:00 (Sabtu 13:00)

      if (todayRecord && todayRecord.checkIn && !todayRecord.checkOut && totalMins >= ALARM_OUT_START && totalMins <= ALARM_OUT_END) {
        const dismissedKey = `fast-absen-dismissed-out-${todayStr}-${employee.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);

        if (!isDismissed && hasTriggeredRef.current.outDate !== todayStr) {
          hasTriggeredRef.current.outDate = todayStr;
          setActiveAlarm("out");
          soundService.startAlarmLoop("out");

          // Kirim Notifikasi Sistem ke Layar HP
          NotificationService.sendSystemNotification("🔔 Peringatan Absen Pulang!", {
            body: `Halo ${employee.name}, sudah jam 17:00 WIB! Jam kerja hari ini telah selesai, silakan absen pulang.`,
          });
          return;
        }
      }
    };

    checkAlarmTime();
    const interval = setInterval(checkAlarmTime, 5000);
    return () => clearInterval(interval);
  }, [todayRecord, employee.id, employee.name]);

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

  const handleEnableNotification = async () => {
    const granted = await NotificationService.requestPermission();
    setNotifPermission(NotificationService.getPermission());
    if (granted) {
      // Register Cloud Push Subscription for server-side push notifications
      await registerPushNotification(employee.id);

      NotificationService.sendSystemNotification("✅ Notifikasi HP Berhasil Aktif!", {
        body: "Anda akan menerima notifikasi pengingat absen masuk (08:30) & absen pulang (17:00) langsung di layar HP meskipun aplikasi ditutup.",
      });
    }
  };

  return (
    <>
      {/* Widget Alarm & Notifikasi di Dashboard Karyawan */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3 my-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Alarm & Notifikasi HP Active
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              </p>
              <p className="text-[11px] text-muted-foreground">
                Masuk: <strong className="text-foreground">08:30 WIB</strong> · Pulang: <strong className="text-foreground">17:00 WIB</strong>
              </p>
            </div>
          </div>

          {notifPermission !== "granted" ? (
            <button
              onClick={handleEnableNotification}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <Smartphone className="w-4 h-4" /> Aktifkan Notifikasi Layar HP 🔔
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-semibold border border-emerald-200 shrink-0">
              <Bell className="w-3.5 h-3.5" /> Notifikasi HP Aktif
            </span>
          )}
        </div>

        {/* Tombol Uji Coba Suara */}
        <div className="pt-2 border-t border-border flex items-center gap-2">
          <button
            onClick={() => handleTestSound("in")}
            className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
              testingSound === "in"
                ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                : "bg-muted text-foreground border-border hover:bg-muted/80"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            {testingSound === "in" ? "Bunyi..." : "Tes Nada Masuk"}
          </button>

          <button
            onClick={() => handleTestSound("out")}
            className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
              testingSound === "out"
                ? "bg-emerald-600 text-white border-emerald-700 animate-pulse"
                : "bg-muted text-foreground border-border hover:bg-muted/80"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            {testingSound === "out" ? "Bunyi..." : "Tes Nada Pulang"}
          </button>

          {notifPermission === "granted" && (
            <button
              onClick={() => {
                NotificationService.sendSystemNotification("🔔 Tes Notifikasi Layar HP", {
                  body: "Ini adalah contoh notifikasi pengingat absen yang akan muncul di layar HP Anda!",
                });
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" /> Tes Notif HP
            </button>
          )}
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
