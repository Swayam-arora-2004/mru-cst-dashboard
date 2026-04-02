const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sync() {
  console.log('🔄 Starting Retro-Sync of Activities...');

  // 1. Fetch all assignments
  const { data: assignments } = await supabase.from('assignments').select('*');
  console.log(`Found ${assignments?.length || 0} assignments.`);

  for (const a of (assignments || [])) {
    const { error } = await supabase.from('activities').upsert({
      id: a.id,
      teacher_id: a.teacher_id,
      course_id: a.course_id,
      title: a.title,
      type: 'assignment',
      date: a.date,
      max_marks: a.max_marks,
      due_date: a.due_date,
      question_file_url: a.question_file_url
    });
    if (error) console.error(`Error syncing assignment ${a.id}:`, error.message);
    else console.log(`✅ Synced assignment: ${a.title}`);
  }

  // 2. Fetch all document tasks
  const { data: docs } = await supabase.from('document_tasks').select('*');
  console.log(`Found ${docs?.length || 0} document tasks.`);

  for (const d of (docs || [])) {
    const { error } = await supabase.from('activities').upsert({
      id: d.id,
      teacher_id: d.teacher_id,
      course_id: d.course_id,
      title: d.title,
      type: 'document',
      date: d.date,
      due_date: d.due_date
    });
    if (error) console.error(`Error syncing document ${d.id}:`, error.message);
    else console.log(`✅ Synced document: ${d.title}`);
  }

  console.log('🏁 Retro-Sync Complete!');
}

sync();
