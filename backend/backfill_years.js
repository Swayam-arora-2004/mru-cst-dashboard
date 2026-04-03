const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillYears() {
  console.log("Starting academic year backfill...");

  const tables = ['attendance_sessions', 'assignments', 'document_tasks', 'activities'];

  for (const table of tables) {
    console.log(`\nChecking table: ${table}`);
    
    const { data, error } = await supabase
      .from(table)
      .select('id, semester')
      .is('year', null);

    if (error) {
      console.error(`Error fetching from ${table}:`, error.message);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`No records with null years in ${table}.`);
      continue;
    }

    console.log(`Found ${data.length} records to update in ${table}.`);

    for (const record of data) {
      if (record.semester) {
        const derivedYear = Math.ceil(record.semester / 2);
        const { error: updateError } = await supabase
          .from(table)
          .update({ year: derivedYear })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Error updating ${table} record ${record.id}:`, updateError.message);
        } else {
          process.stdout.write('.');
        }
      }
    }
    console.log(`\nTable ${table} update finished.`);
  }

  console.log("\nBackfill complete.");
}

backfillYears();
