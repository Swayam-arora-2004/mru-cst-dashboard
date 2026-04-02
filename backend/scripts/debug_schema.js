
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking evaluations table info...');
  
  // Try to get one record to see columns
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching evaluations:', error.message);
  } else {
    console.log('Columns in evaluations:', Object.keys(data[0] || {}));
  }

  // Try a test insert with type 'document'
  console.log('Testing insert with type "document"...');
  const { error: insertError } = await supabase
    .from('evaluations')
    .insert({
        teacher_id: '00000000-0000-0000-0000-000000000000', // Dummy
        student_id: '00000000-0000-0000-0000-000000000000', // Dummy
        activity_id: '00000000-0000-0000-0000-000000000000', // Dummy
        type: 'document',
        grade: 'TEST',
        marks_attained: 0,
        source: 'system'
    });

  if (insertError) {
    console.log('Insert FAILED:', insertError.message);
    if (insertError.details) console.log('Details:', insertError.details);
    if (insertError.hint) console.log('Hint:', insertError.hint);
  } else {
    console.log('Insert SUCCESSFUL (ignoring FK errors if any, but type was ok)');
  }
}

checkSchema();
