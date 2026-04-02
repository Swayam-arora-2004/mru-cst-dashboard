import cron from 'node-cron';
import { getSupabaseAdminClient } from './supabase';
import { NotificationService } from './notifications';
import logger from './logger';

/**
 * [AUTOMATED SCHEDULER] 
 * Handles recurring tasks like Weekly Performance Reports.
 */
export const initCronJobs = () => {
  // 📅 Weekly Report: Every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Starting Automated Weekly Report Generation...');
    
    try {
      const supabase = getSupabaseAdminClient();
      
      // 1. Fetch all teachers (to send individualized reports)
      const { data: teachers } = await supabase.from('teachers').select('*');
      
      if (!teachers) return;

      for (const teacher of teachers) {
        // 2a. Check User Preferences for Weekly Report
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('weekly_report')
          .eq('user_id', teacher.id)
          .single();

        if (prefs && prefs.weekly_report === false) {
          logger.info(`Skipping report for ${teacher.name} (Preference disabled)`);
          continue;
        }

        // 2b. Aggregate stats for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoDate = sevenDaysAgo.toISOString().split('T')[0];

        const [attendance, evaluations] = await Promise.all([
          supabase.from('attendance_sessions').select('id').eq('teacher_id', teacher.id).gte('date', isoDate),
          supabase.from('activities').select('id').eq('teacher_id', teacher.id).gte('date', isoDate)
        ]);

        const totalSessions = attendance.data?.length || 0;
        const totalEvaluations = evaluations.data?.length || 0;

        // 2c. Only send if there was actual activity (Necessary Updates Only)
        if (totalSessions === 0 && totalEvaluations === 0) {
          logger.info(`No activity for ${teacher.name}, skipping weekly report.`);
          continue;
        }

        // 3. Construct professional HTML report
        const reportHtml = `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #2563eb; margin-top: 0;">Weekly Intelligence Summary</h2>
            <p>Hello Professor ${teacher.name}, here is your academic overview for the past 7 days:</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
              <div style="background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${totalSessions}</div>
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Sessions</div>
              </div>
              <div style="background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${totalEvaluations}</div>
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Evaluations</div>
              </div>
            </div>

            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Your activities are currently being processed by the AI pipeline. You can review detailed automated grading and student performance metrics in your dashboard.
            </p>

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              MRU CST Intelligence System • Automated Admin Record • ${new Date().toLocaleDateString()}
            </p>
          </div>
        `;

        await NotificationService.sendEmail(
          teacher.email, 
          `Intelligence Report: ${new Date().toLocaleDateString()}`, 
          reportHtml
        );
        
        logger.info(`Weekly report sent to ${teacher.email}`);
      }

      logger.info('Weekly reports dispatched successfully.');
    } catch (err: any) {
      logger.error('CRON_WEEKLY_REPORT_FAILURE:', err.message);
    }
  });

  logger.info('Cron jobs initialized: [Weekly Reports]');
};
