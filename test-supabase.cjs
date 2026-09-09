const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cvrhmwqmprefrvzqlkvo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FR-_Sb7AYGLVl-dYm4p7Nw_igmF1ZsV';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from('push_subscriptions').select('*');
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
  console.log('Data:', data);
}
test();
