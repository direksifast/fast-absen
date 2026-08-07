// ─── UTILS SYSTEM PUSH NOTIFICATION (NOTIFIKASI LAYAR HP / BROWSER) ───

export class NotificationService {
  /**
   * Cek apakah browser / HP mendukung Notifikasi
   */
  public static isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /**
   * Status izin saat ini ('granted' | 'denied' | 'default')
   */
  public static getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  /**
   * Minta izin notifikasi layar HP dari pengguna
   */
  public static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (e) {
      console.error("Gagal meminta izin notifikasi:", e);
      return false;
    }
  }

  /**
   * Kirim notifikasi sistem langsung ke layar HP / Notification Bar
   */
  public static async sendSystemNotification(title: string, options?: NotificationOptions) {
    if (!this.isSupported() || Notification.permission !== "granted") {
      return;
    }

    try {
      // 1. Coba lewat Service Worker jika ada (PWA mode)
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            icon: "/pwa-192x192.png",
            badge: "/badge.png",
            vibrate: [300, 100, 300, 100, 300],
            requireInteraction: true,
            tag: "fast-absen-reminder",
            ...options,
          } as any);
          return;
        }
      }

      // 2. Fallback Notifikasi Browser standar
      const notif = new Notification(title, {
        icon: "/pwa-192x192.png",
        vibrate: [300, 100, 300],
        ...options,
      } as any);

      notif.onclick = () => {
        window.focus();
      };
    } catch (e) {
      console.error("Gagal mengirim notifikasi sistem:", e);
    }
  }
}
