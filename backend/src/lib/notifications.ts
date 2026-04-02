import nodemailer from 'nodemailer';
import webpush from 'web-push';
import logger from './logger';
import { getSupabaseAdminClient } from './supabase';

// 🔑 VAPID Keys for Web Push (Should be in .env but generated as fallback)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BF7X_R5G...',
  privateKey: process.env.VAPID_PRIVATE_KEY || '...'
};

try {
  if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
      'mailto:support@mru-cst.edu',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }
} catch (e) {
  logger.warn('VAPID details not set correctly. Web push will be disabled.');
}

/**
 * [COMMUNICATION SERVICE] 
 * Central hub for all instructor & student notifications.
 */
export const NotificationService = {
  /**
   * Intelligently dispatches notifications based on user preferences.
   * @param userId UUID of the teacher or student
   * @param payload { title, body, emailHtml? }
   */
  async notifyUser(userId: string, payload: { title: string; body: string; emailHtml?: string }) {
    const supabase = getSupabaseAdminClient();
    
    // 1. Fetch User Preferences & Email
    const [{ data: prefs }, { data: user }] = await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('teachers').select('email').eq('id', userId).single()
        .then(res => res.data ? res : supabase.from('students').select('email').eq('id', userId).single() as any)
    ]);

    const emailNotifications = prefs?.email_notifications ?? true;
    const pushNotifications = prefs?.push_notifications ?? true;

    const results: any = { email: null, push: null };

    // 2. Dispatch Email
    if (emailNotifications && user?.email) {
      results.email = await this.sendEmail(
        user.email,
        payload.title,
        payload.emailHtml || `<p>${payload.body}</p>`
      );
    }

    // 3. Dispatch Push
    if (pushNotifications) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subscriptions && subscriptions.length > 0) {
        results.push = await Promise.all(
          subscriptions.map(sub => this.sendPush(
            { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
            payload.title,
            payload.body
          ))
        );
      }
    }

    return results;
  },

  /**
   * Sends a professional Email notification via Nodemailer.
   */
  async sendEmail(to: string, subject: string, html: string) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'test@ethereal.email',
          pass: process.env.SMTP_PASS || 'pass'
        }
      });

      const info = await transporter.sendMail({
        from: '"MRU CST Intelligence" <noreply@mru-cst.edu>',
        to,
        subject,
        html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`📧 Ethereal Email Preview: ${previewUrl}`);
      }

      logger.info(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, previewUrl };
    } catch (err: any) {
      logger.error('EMAIL_DISPATCH_FAILURE:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sends a real-time Web Push notification to the browser.
   */
  async sendPush(subscription: any, title: string, body: string, icon: string = '/logo.png') {
    try {
      if (!vapidKeys.publicKey) return { success: false, error: 'Push service not configured' };
      
      const payload = JSON.stringify({
        title,
        body,
        icon,
        data: { url: '/dashboard' }
      });

      await webpush.sendNotification(subscription, payload);
      logger.info(`Push notification sent successfully`);
      return { success: true };
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        logger.warn('Push subscription expired or removed');
      } else {
        logger.error('PUSH_DISPATCH_FAILURE:', err.message);
      }
      return { success: false, error: err.message };
    }
  }
};
