import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, X, ArrowUpRight } from "lucide-react";

interface VersionData {
  version: string;
  builtAt?: string;
}

export function VersionChecker() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isReloading, setIsReloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const currentVersionRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const forceReload = useCallback(() => {
    setIsReloading(true);
    // Reload from server bypassing cache if possible
    window.location.reload();
  }, []);

  const checkVersion = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      // Add timestamp query parameter to bypass browser/CDN cache
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) {
        isCheckingRef.current = false;
        return;
      }

      const data: VersionData = await res.json();
      const serverVersion = data.version;

      if (!currentVersionRef.current) {
        // First load: store the current version
        currentVersionRef.current = serverVersion;
      } else if (serverVersion !== currentVersionRef.current) {
        // A new version deployment is detected!
        console.log(`[VersionChecker] New version detected! Current: ${currentVersionRef.current}, Server: ${serverVersion}`);

        // SMART HYBRID LOGIC:
        // If tab is hidden/backgrounded, silently reload immediately!
        if (document.visibilityState === "hidden" || !document.hasFocus()) {
          console.log("[VersionChecker] Tab is hidden/unfocused. Triggering Silent Auto-Reload.");
          forceReload();
          return;
        }

        // If tab is currently active/visible, trigger Opsi A (Toast with countdown)
        setHasUpdate(true);
      }
    } catch (err) {
      console.warn("[VersionChecker] Failed to fetch version info:", err);
    } finally {
      isCheckingRef.current = false;
    }
  }, [forceReload]);

  // Handle global Vite chunk load errors (Safety Net)
  useEffect(() => {
    const handlePreloadError = (e: Event) => {
      console.warn("[VersionChecker] Preload error detected, triggering auto-recovery reload...", e);
      forceReload();
    };

    const handleWindowError = (e: ErrorEvent) => {
      if (
        e.message &&
        (e.message.includes("Failed to fetch dynamically imported module") ||
          e.message.includes("Importing a module script failed") ||
          e.message.includes("Loading chunk"))
      ) {
        console.warn("[VersionChecker] Chunk load error detected, reloading...", e.message);
        forceReload();
      }
    };

    window.addEventListener("vite:preloadError", handlePreloadError);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("vite:preloadError", handlePreloadError);
      window.removeEventListener("error", handleWindowError);
    };
  }, [forceReload]);

  // Periodic polling & Visibility Change Handler
  useEffect(() => {
    // Initial check
    checkVersion();

    // Check every 30 seconds
    const interval = setInterval(checkVersion, 30000);

    // Check immediately when user switches back to this tab or unlocks screen
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [checkVersion]);

  // Countdown timer logic for Toast UI
  useEffect(() => {
    if (!hasUpdate || dismissed) return;

    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          forceReload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [hasUpdate, dismissed, forceReload]);

  if (!hasUpdate || dismissed) return null;

  return (
    <div
      className="fixed bottom-5 right-5 left-5 md:left-auto md:max-w-md z-[9999] bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-primary/40 backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-300 overflow-hidden"
      style={{ animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* Top Animated Progress Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted/20 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-1000 linear"
          style={{ width: `${(countdown / 5) * 100}%` }}
        />
      </div>

      <div className="flex items-start gap-3.5 pt-1">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 text-primary-foreground animate-pulse">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              Fitur Baru Tersedia!
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Update Vercel
              </span>
            </h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Tunda notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Sistem diperbarui otomatis dalam <span className="font-bold text-amber-300 text-sm">{countdown}</span> detik agar fitur baru langsung aktif.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={forceReload}
              disabled={isReloading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2 px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
              {isReloading ? "Memperbarui..." : "Update Sekarang"}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
            >
              Tunda 5 Mnt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
