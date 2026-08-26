import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Fix ESM JSON import for Vercel Serverless Function
const vapidPath = path.join(process.cwd(), 'src/utils/vapidKeys.json');
const vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cvrhmwqmprefrvzqlkvo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_FR-_Sb7AYGLVl-dYm4p7Nw_igmF1ZsV';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configure Web Push with VAPID keys
try {
  webpush.setVapidDetails(
    'mailto:admin@fastabsen.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (e) {
  console.error('[CronReminder] Failed to set VAPID details:', e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for cross-origin cron calls or frontend testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let type = req.query.type as string;
  const isTest = req.query.test === 'true';

  // Otomatis tentukan tipe notifikasi jika tidak dispesifikasikan (UTC+7 WIB)
  if (!type || type === 'auto') {
    const wibHour = (new Date().getUTCHours() + 7) % 24;
    if (wibHour >= 5 && wibHour < 12) {
      type = 'in';
    } else {
      type = 'out';
    }
  }

  let title = '⏰ Peringatan Absen Masuk!';
  let body = 'Sudah jam 08:30 WIB! Jangan lupa segera lakukan Absen Masuk sebelum jam 09:00 WIB agar tidak terlambat.';

  if (type === 'out') {
    title = '🔔 Peringatan Absen Pulang!';
    body = 'Sudah jam 17:00 WIB! Jam kerja hari ini telah selesai, silakan lakukan Absen Pulang sekarang.';
  }

  if (isTest) {
    title = '🧪 Tes Push Notification Cloud (WhatsApp Style)';
    body = 'Berhasil! Notifikasi ini dikirim langsung dari Server Vercel ke HP Anda, meskipun aplikasi sedang ditutup total!';
  }

  const payload = JSON.stringify({
    title,
    body,
    url: '/',
    timestamp: Date.now()
  });

  console.log(`[CronReminder] Running push trigger for type: ${type}, test: ${isTest}`);

  try {
    // 1. Ambil semua token push subscription dari Supabase
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('[CronReminder] Error fetching push subscriptions:', error);
      return res.status(500).json({ error: 'Database error fetching subscriptions', details: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[CronReminder] No push subscriptions registered in database.');
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'No push subscriptions found in database. Silakan klik Aktifkan Notifikasi di HP terlebih dahulu!'
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    // 2. Kirim push notification ke setiap perangkat yang terdaftar
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSub, payload);
        sentCount++;
      } catch (err: any) {
        failedCount++;
        console.error(`[CronReminder] Failed to send push to ${sub.employee_id}:`, err?.statusCode || err?.message);
        // Tangkap status 404/410 (Subscription kadaluarsa / disetujui ulang)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    });

    await Promise.all(sendPromises);

    // 3. Hapus subscription yang sudah kadaluarsa (stale) dari database
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
      console.log(`[CronReminder] Cleaned up ${expiredEndpoints.length} expired subscriptions.`);
    }

    return res.status(200).json({
      success: true,
      triggerType: type,
      totalSubscriptions: subscriptions.length,
      sentCount,
      failedCount,
      cleanedExpired: expiredEndpoints.length,
      payloadSent: { title, body }
    });
  } catch (err: any) {
    console.error('[CronReminder] Unhandled error during cron execution:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}


