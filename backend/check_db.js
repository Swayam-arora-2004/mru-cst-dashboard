const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('students').select('id, name, profile_image_url, face_encoding').order('created_at', { ascending: false }).limit(2);
  console.log('Latest students:', JSON.stringify(data, null, 2));
}
run();
