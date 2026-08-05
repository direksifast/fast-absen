import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cvrhmwqmprefrvzqlkvo.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_FR-_Sb7AYGLVl-dYm4p7Nw_igmF1ZsV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { employeeId, subscription } = req.body || {};
      if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return res.status(400).json({ error: 'Subscription object missing or invalid' });
      }

      const id = employeeId || 'guest';
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            employee_id: id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        console.error('[API /subscribe] Supabase insert error:', error);
        return res.status(500).json({ error: 'Database error saving subscription', details: error.message });
      }

      console.log(`[API /subscribe] Successfully saved push subscription to Supabase for employee: ${id}`);
      return res.status(200).json({ success: true, message: 'Push subscription registered successfully in Supabase' });
    } catch (err: any) {
      console.error('[API /subscribe] Server error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });

      return res.status(200).json({
        status: 'active',
        totalSubscriptions: count || 0,
        error: error ? error.message : null
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

