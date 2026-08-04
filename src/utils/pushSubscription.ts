import vapidKeys from "./vapidKeys.json";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotification(employeeId?: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[WebPush] Web Push Notifications tidak didukung di browser ini.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[WebPush] Izin notifikasi ditolak oleh pengguna.");
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidKeys.publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    console.log("[WebPush] Push Subscription berhasil didapatkan:", subscription);

    // Send PushSubscription to Vercel API backend
    const payload = {
      employeeId: employeeId || "guest",
      subscription: subscription.toJSON(),
    };

    // Save to localStorage as backup
    localStorage.setItem("fast-absen-push-sub", JSON.stringify(payload));

    // Try sending to /api/subscribe
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[WebPush] Subscription berhasil didaftarkan ke server!");
    } catch (apiErr) {
      console.warn("[WebPush] Mengirim ke /api/subscribe gagal (mungkin di dev mode local), backup tersimpan di client:", apiErr);
    }

    return true;
  } catch (err) {
    console.error("[WebPush] Gagal mendaftarkan Push Notification:", err);
    return false;
  }
}
