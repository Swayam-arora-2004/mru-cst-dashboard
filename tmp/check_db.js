
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('Checking database tables...');
  
  const tables = ['attendance_sessions', 'attendance_records', 'courses'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Table "${table}" error:`, error.message);
    } else {
      console.log(`✅ Table "${table}" exists.`);
    }
  }
}

checkTables();
