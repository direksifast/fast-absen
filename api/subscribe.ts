import type { VercelRequest, VercelResponse } from '@vercel/node';

// Shared memory store for Vercel Serverless environment
// For persistence across deployments, Supabase or Vercel KV can be attached
const subscriptionsStore: Map<string, any> = new Map();

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
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Subscription object missing or invalid' });
      }

      const id = employeeId || 'guest';
      subscriptionsStore.set(id, {
        subscription,
        updatedAt: new Date().toISOString()
      });

      console.log(`[API /subscribe] Successfully registered push subscription for employee: ${id}`);
      return res.status(200).json({ success: true, message: 'Push subscription registered successfully' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      totalSubscriptions: subscriptionsStore.size
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
