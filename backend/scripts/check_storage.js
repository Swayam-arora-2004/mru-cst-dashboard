
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  console.log('Checking Storage Buckets...');
  const { data, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error listing buckets:', error.message);
  } else {
    console.log('Available buckets:', data.map(b => b.name));
    const hasSubmissions = data.some(b => b.name === 'submissions');
    if (!hasSubmissions) {
      console.log('CRITICAL: "submissions" bucket is MISSING!');
      console.log('Creating "submissions" bucket...');
      const { error: createError } = await supabase.storage.createBucket('submissions', { public: true });
      if (createError) console.error('Failed to create submissions bucket:', createError.message);
      else console.log('Successfully created "submissions" bucket.');
    }
  }
}

checkBuckets();
