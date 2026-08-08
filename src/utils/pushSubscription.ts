import vapidKeys from "./vapidKeys.json";
import { supabase } from "../services/supabase";

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

export async function registerPushNotification(employeeId?: string, forceRenew: boolean = false): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[WebPush] Web Push Notifications tidak didukung di browser/device ini.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[WebPush] Izin notifikasi ditolak oleh pengguna.");
      return false;
    }

    // Pastikan ServiceWorker terdaftar & ready
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();

    if (forceRenew && subscription) {
      try {
        await subscription.unsubscribe();
        console.log("[WebPush] Subscription lama dibatalkan untuk pembaruan token...");
        subscription = null;
      } catch (unsubErr) {
        console.warn("[WebPush] Gagal unsubscribe token lama:", unsubErr);
      }
    }

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidKeys.publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    console.log("[WebPush] Push Subscription berhasil didapatkan:", subscription);

    const subJson = subscription.toJSON();
    const targetEmpId = employeeId || "guest";

    // 1. Simpan langsung ke Supabase client (Client-side Direct Save)
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      try {
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            employee_id: targetEmpId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        );
        if (error) {
          console.warn("[WebPush] Direct Supabase upsert note:", error.message);
        } else {
          console.log("[WebPush] Subscription tersimpan langsung ke Supabase ✓");
        }
      } catch (sbErr) {
        console.warn("[WebPush] Direct Supabase error:", sbErr);
      }
    }

    // 2. Kirim ke Vercel Serverless API Endpoint (/api/subscribe)
    const payload = {
      employeeId: targetEmpId,
      subscription: subJson,
    };
    localStorage.setItem("fast-absen-push-sub", JSON.stringify(payload));

    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[WebPush] Subscription berhasil didaftarkan via /api/subscribe!");
    } catch (apiErr) {
      console.warn("[WebPush] Call to /api/subscribe warning:", apiErr);
    }

    return true;
  } catch (err) {
    console.error("[WebPush] Gagal mendaftarkan Push Notification:", err);
    return false;
  }
}

