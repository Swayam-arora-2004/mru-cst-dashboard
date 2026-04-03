const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecializations() {
  const { data: students, error: studentError } = await supabase.from('students').select('name, specialization').limit(20);
  const { data: courses, error: courseError } = await supabase.from('courses').select('name, specialization').limit(20);
  
  if (studentError) console.error("Student error:", studentError);
  else {
    console.log("Students Sample:");
    console.table(students);
  }
  
  if (courseError) console.error("Course error:", courseError);
  else {
    console.log("Courses Sample:");
    console.table(courses);
  }
}

checkSpecializations();
