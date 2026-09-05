import { useState, useEffect, useRef } from "react";
import { BellRing, Volume2, CheckCircle2, X, Smartphone, Bell, RefreshCw, HelpCircle, AlertTriangle } from "lucide-react";
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
  const [testingPush, setTestingPush] = useState(false);
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

    // Otomatis Daftarkan Web Push Subscription untuk Notifikasi Server saat aplikasi ditutup
    if (NotificationService.getPermission() === "granted") {
      registerPushNotification(employee.id).catch((err) => {
        console.warn("[AttendanceAlarm] Push registration warning:", err);
      });
    }

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [employee.id]);

  // Timer pengecekan setiap 5 detik untuk alarm otomatis saat app terbuka
  useEffect(() => {
    const checkAlarmTime = () => {
      if (employee.isFieldWorker) return;
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
            body: `Halo ${employee.name}, sudah jam ${isSaturday ? '12:00' : '17:00'} WIB! Jam kerja hari ini telah selesai, silakan absen pulang.`,
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
      }, 12000);
    }
  };

  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleEnableNotification = async () => {
    const granted = await NotificationService.requestPermission();
    setNotifPermission(NotificationService.getPermission());
    if (granted) {
      const ok = await registerPushNotification(employee.id, true);
      if (ok) {
        setTestResult("✅ Notifikasi HP berhasil diaktifkan dan didaftarkan ke server!");
        NotificationService.sendSystemNotification("✅ Notifikasi HP Berhasil Aktif!", {
          body: "Anda akan menerima notifikasi pengingat absen masuk (08:30) & absen pulang (17:00) langsung di layar HP meskipun aplikasi ditutup.",
        });
      } else {
        setTestResult("⚠️ Izin diberikan, namun pendaftaran push ke server gagal. Coba lagi.");
      }
    } else {
      setTestResult("❌ Izin notifikasi ditolak oleh browser/HP. Silakan aktifkan izin notifikasi di setelan browser.");
    }
  };

  const handleTestCloudPush = async () => {
    setTestingPush(true);
    setTestResult(null);

    // 1. Daftarkan/Perbarui push subscription terbaru
    const registered = await registerPushNotification(employee.id, true);

    if (!registered) {
      setTestResult("❌ Gagal mendapatkan token Push Subscription. Pastikan izin notifikasi diizinkan!");
      setTestingPush(false);
      return;
    }

    // 2. Tampilkan countdown 5 detik agar pengguna sempat menutup aplikasi/mengunci HP
    let secondsLeft = 5;
    setTestCountdown(secondsLeft);

    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        setTestCountdown(secondsLeft);
      } else {
        clearInterval(timer);
        setTestCountdown(null);
        // 3. Panggil API Vercel Serverless Push Notification
        fetch("/api/cron-reminder?type=in&test=true")
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setTestResult(
                `🚀 Notifikasi server dikirim ke ${data.sentCount} dari ${data.totalSubscriptions} perangkat terdaftar! Cek Notification Bar HP Anda.`
              );
            } else {
              setTestResult(`⚠️ Respon server: ${data.error || data.message || "Gagal mengirim push"}`);
            }
          })
          .catch((err) => {
            setTestResult(`❌ Gagal menghubungi API Push Server: ${err.message}`);
          })
          .finally(() => {
            setTestingPush(false);
          });
      }
    }, 1000);
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
                Alarm & Push Notif HP (WhatsApp Style)
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              </p>
              <p className="text-[11px] text-muted-foreground">
                Masuk: <strong className="text-foreground">08:30 WIB</strong> · Pulang: <strong className="text-foreground">17:00 WIB</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {notifPermission !== "granted" ? (
              <button
                onClick={handleEnableNotification}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <Smartphone className="w-4 h-4" /> Aktifkan Notifikasi HP 🔔
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-semibold border border-emerald-200 shrink-0">
                <Bell className="w-3.5 h-3.5" /> Notifikasi HP Aktif
              </span>
            )}

            <button
              onClick={() => setShowGuideModal(true)}
              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0"
              title="Panduan Notifikasi HP saat aplikasi ditutup"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status / Test Result Message */}
        {testCountdown !== null && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
            <span>
              ⏰ Mengirim Notifikasi Cloud dalam <strong>{testCountdown} detik</strong>... <strong>TUTUP / MINIMIZE HP SEKARANG</strong> untuk menguji popup!
            </span>
          </div>
        )}

        {testResult && (
          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-medium flex items-center justify-between gap-2">
            <span>{testResult}</span>
            <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tombol Uji Coba Suara & Push Server */}
        <div className="pt-2 border-t border-border flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
              onClick={handleTestCloudPush}
              disabled={testingPush}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 shrink-0"
              title="Mengirim push notification langsung dari Server Vercel"
            >
              {testingPush ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
              {testingPush ? "Menguji..." : "Tes Push (App Ditutup)"}
            </button>
          )}
        </div>
      </div>

      {/* ─── MODAL PANDUAN NOTIFIKASI HP ─── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" /> Panduan Notifikasi Pop-up HP (WhatsApp Style)
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> Mengapa Notifikasi HP Suka Tidak Muncul Saat App Ditutup?
                </p>
                <p>
                  Browser Android (Chrome) & iOS (Safari) memiliki sistem penghemat baterai ketat yang sering mematikan notifikasi jika pengaturannya belum diizinkan.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-foreground">📱 1. Untuk HP Android (Xiaomi / Samsung / Oppo / Vivo / Realme):</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Buka <strong>Pengaturan HP &gt; Aplikasi &gt; Kelola Aplikasi &gt; Chrome (atau Browser Anda)</strong>.</li>
                  <li>Di menu <strong>Izin Notifikasi</strong>, pastikan Layar Kunci &amp; Pop-up Diizinkan.</li>
                  <li>Di menu <strong>Penghemat Baterai</strong>, ubah dari &quot;Hemat Baterai (Rekomendasi)&quot; menjadi <strong>&quot;Tidak Ada Pembatasan (Unrestricted)&quot;</strong>.</li>
                  <li>Aktifkan opsi <strong>Mulai Otomatis (Autostart)</strong> agar Chrome diperbolehkan menerima Notifikasi Server saat ditutup.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-foreground">🍎 2. Untuk iPhone / iOS (Safari):</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Apple mengharuskan web ini ditambahkan ke Layar Utama terlebih dahulu.</li>
                  <li>Buka web di <strong>Safari</strong> &gt; Tekan tombol <strong>Bagikan (Share)</strong> &gt; Pilih <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.</li>
                  <li>Buka aplikasi dari Icon di Layar Utama HP, lalu klik <strong>Aktifkan Notifikasi HP 🔔</strong>.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-foreground">⚡ 3. Otomatisasi Cron Server (Vercel Free Plan Notice):</p>
                <p>
                  Pengingat otomatis dijadwalkan setiap <strong>08:30 WIB</strong> (Masuk) &amp; <strong>17:00 WIB</strong> (Pulang). Jika menggunakan akun Vercel Free, batas cron gratis adalah 1x/hari. Anda bisa mendaftarkan URL Cron berikut ke service gratis <code>cron-job.org</code>:
                </p>
                <div className="p-2 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] break-all select-all">
                  {window.location.origin}/api/cron-reminder?type=auto
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition-opacity"
            >
              Mengerti &amp; Tutup Panduan
            </button>
          </div>
        </div>
      )}

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
                <h2 className="text-2xl font-black text-foreground mb-2">Sudah Jam {new Date().getDay() === 6 ? '12:00' : '17:00'} WIB!</h2>
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
