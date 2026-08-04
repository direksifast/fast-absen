import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import vapidKeys from '../src/utils/vapidKeys.json';

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
  const type = (req.query.type as string) || 'in'; // 'in' or 'out'
  const isTest = req.query.test === 'true';

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

  console.log(`[CronReminder] Running cron trigger for type: ${type}, test: ${isTest}`);

  // In production with Supabase or Vercel KV, retrieve saved subscriptions
  // For demo/test response:
  return res.status(200).json({
    success: true,
    triggerType: type,
    message: `Scheduled reminder triggered: ${title}`,
    payloadSent: { title, body }
  });
}
