import { Router, Response } from 'express';
import { getSupabaseAdminClient } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ApiResponse } from '../types';
import { NotificationService } from '../lib/notifications';
import logger from '../lib/logger';

const router = Router();

/**
 * 📡 Save/Update Push Subscription
 * Used for real-time browser notifications.
 */
router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription) {
      return res.status(400).json({ success: false, error: 'Subscription object required' });
    }

    const supabase = getSupabaseAdminClient();
    
    // Check if subscription already exists for this user/device
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('endpoint', subscription.endpoint)
      .single();

    if (existing) {
      // Update existing subscription timestamp
      await supabase
        .from('push_subscriptions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Insert new subscription
      await supabase
        .from('push_subscriptions')
        .insert({
          user_id: req.user!.id,
          endpoint: subscription.endpoint,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
          user_agent: req.headers['user-agent']
        });
    }

    res.status(200).json({ success: true, message: 'Subscription saved successfully' });
  } catch (err: any) {
    logger.error('PUSH_SUBSCRIBE_ERROR:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error during subscription' });
  }
});

/**
 * 📢 Trigger Manual Test Notification
 * Primarily for developers/professors to verify setup.
 */
router.post('/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: user } = await supabase
      .from('teachers')
      .select('name, email')
      .eq('id', req.user!.id)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Attempt to send test email
    const emailResult = await NotificationService.sendEmail(
      user.email,
      'Test Alert: MRU CST Intelligence System',
      `<h1>System Verification</h1><p>Hello Professor ${user.name}, your email notification subsystem is now fully operational.</p>`
    );

    // Attempt to send test push (fetch active subscription)
    const { data: latestSub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let pushResult = { success: false, info: 'No active push subscription found' };
    if (latestSub) {
      pushResult = await NotificationService.sendPush(
        { 
          endpoint: latestSub.endpoint, 
          keys: { auth: latestSub.auth, p256dh: latestSub.p256dh } 
        },
        'System Verification',
        'Your browser push notifications are active!'
      ) as any;
    }

    // 3. Simulated Weekly Report
    const reportHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb; margin-top: 0;">Weekly Intelligence Summary (TEST)</h2>
        <p>Hello Professor ${user.name}, this is a <strong>simulated</strong> academic overview for your verification:</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: bold; color: #2563eb;">12</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Sessions</div>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: bold; color: #10b981;">45</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Evaluations</div>
          </div>
        </div>

        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          This email confirms your weekly report subsystem is active. Every Monday, you will receive a real summary of your academic impact.
        </p>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          MRU CST Intelligence System • Automated Test Record • ${new Date().toLocaleDateString()}
        </p>
      </div>
    `;

    const reportResult = await NotificationService.sendEmail(
      user.email,
      'Intelligence Report (TEST RESPONSE)',
      reportHtml
    );

    res.status(200).json({ 
      success: true, 
      data: { email: emailResult, push: pushResult, report: reportResult } 
    });
  } catch (err: any) {
    logger.error('TEST_NOTIFICATION_ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
