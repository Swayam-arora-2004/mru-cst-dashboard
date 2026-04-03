const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillYears() {
  console.log("Starting academic year backfill...");

  const tables = ['attendance_sessions', 'assignments', 'document_tasks', 'activities'];

  for (const table of tables) {
    console.log(`Backfilling table: ${table}`);
    
    // Fetch records with null years
    const { data, error } = await supabase
      .from(table)
      .select('id, semester')
      .is('year', null);

    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      continue;
    }

    console.log(`Found ${data.length} records in ${table} with null years.`);

    for (const record of data) {
      if (record.semester) {
        const derivedYear = Math.ceil(record.semester / 2);
        const { error: updateError } = await supabase
          .from(table)
          .update({ year: derivedYear })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Error updating ${table} record ${record.id}:`, updateError);
        }
      }
    }
  }

  console.log("Backfill complete.");
}

backfillYears();
