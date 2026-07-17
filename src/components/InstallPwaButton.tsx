import { useState, useEffect } from "react";
import { Download } from "lucide-react";

// Mencegah TypeScript error untuk properti yang tidak ada di standar Window
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Cek apakah aplikasi sudah diinstal
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Mencegah mini-infobar muncul secara otomatis di mobile
      e.preventDefault();
      // Simpan event supaya bisa dipicu nanti
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Tampilkan prompt install
    deferredPrompt.prompt();
    
    // Tunggu respon pengguna
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  if (isInstalled || !deferredPrompt) {
    return null; // Sembunyikan tombol kalau sudah diinstal atau tidak didukung
  }

  return (
    <button
      onClick={handleInstallClick}
      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all group mb-4 border border-blue-500/30"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-105 transition-transform">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div className="text-left">
          <p className="font-bold text-white text-base">Install Shortcut Aplikasi</p>
          <p className="text-xs text-blue-100">Biar absen lebih cepat dari layar utama</p>
        </div>
      </div>
      <div className="bg-white text-blue-700 px-4 py-2 rounded-lg font-bold text-xs shadow-sm">
        Install
      </div>
    </button>
  );
}
