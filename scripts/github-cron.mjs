import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read VAPID keys
const vapidPath = path.join(__dirname, '../src/utils/vapidKeys.json');
const vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvrhmwqmprefrvzqlkvo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_FR-_Sb7AYGLVl-dYm4p7Nw_igmF1ZsV';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

webpush.setVapidDetails(
  'mailto:admin@fastabsen.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

async function run() {
  const type = process.argv[2] || 'in';
  let title = '⏰ Peringatan Absen Masuk!';
  let body = 'Sudah jam 08:30 WIB! Jangan lupa segera lakukan Absen Masuk sebelum jam 09:00 WIB agar tidak terlambat.';

  if (type === 'out') {
    title = '🔔 Peringatan Absen Pulang!';
    body = 'Sudah jam 17:00 WIB! Jam kerja hari ini telah selesai, silakan lakukan Absen Pulang sekarang.';
  }

  const payload = JSON.stringify({
    title,
    body,
    url: '/',
    timestamp: Date.now()
  });

  console.log(`[GitHub Cron] Running push trigger for type: ${type}`);

  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*');

  if (error) {
    console.error('[GitHub Cron] Error fetching subscriptions:', error);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[GitHub Cron] No subscriptions found.');
    process.exit(0);
  }

  let sentCount = 0;
  let failedCount = 0;
  const expiredEndpoints = [];

  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload);
      sentCount++;
    } catch (err) {
      failedCount++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint);
      }
    }
  });

  await Promise.all(promises);

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    console.log(`[GitHub Cron] Cleaned up ${expiredEndpoints.length} expired subscriptions.`);
  }

  console.log(`[GitHub Cron] Finished. Sent: ${sentCount}, Failed: ${failedCount}`);
}

run().catch(console.error);
