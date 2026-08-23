import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });

    return transporter;
}

export async function sendTransactionalEmail(payload: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<{ provider: 'smtp' | 'preview'; messageId?: string }> {
    if (env.EMAIL_DELIVERY_MODE === 'preview' || !env.SMTP_HOST) {
        logger.info('EmailService: preview delivery recorded because SMTP is not configured', {
            to: payload.to,
            subject: payload.subject,
        });
        return { provider: 'preview' };
    }
    const result = await getTransporter().sendMail({
        from: `"RecruitAI" <${env.SMTP_USER}>`,
        ...payload,
    });
    return { provider: 'smtp', messageId: result.messageId };
}

function taskCompletedTemplate(payload: {
    taskType: string;
    taskId: string;
    result: Record<string, unknown>;
}) {
    return {
        subject: `✅ Recruiting Task Completed: ${payload.taskType}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">✅ Task Completed</h2>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151;"><strong>Task Type:</strong> ${payload.taskType.toUpperCase()}</p>
          <p style="color: #374151;"><strong>Task ID:</strong> <code style="background:#e5e7eb; padding: 2px 6px; border-radius: 4px;">${payload.taskId}</code></p>
          <h4 style="color: #374151;">Result:</h4>
          <pre style="background: #1f2937; color: #d1fae5; padding: 16px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(payload.result, null, 2)}</pre>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
          <p style="color: #9ca3af; font-size: 0.85rem;">Recruiting Automation System — Background Worker</p>
        </div>
      </div>
    `,
    };
}

function taskFailedTemplate(payload: {
    taskType: string;
    taskId: string;
    error: string;
    attempts: number;
}) {
    return {
        subject: `❌ Recruiting Task Failed: ${payload.taskType}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">❌ Task Failed</h2>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151;"><strong>Task Type:</strong> ${payload.taskType.toUpperCase()}</p>
          <p style="color: #374151;"><strong>Task ID:</strong> <code style="background:#e5e7eb; padding: 2px 6px; border-radius: 4px;">${payload.taskId}</code></p>
          <p style="color: #374151;"><strong>Attempts Made:</strong> ${payload.attempts}</p>
          <h4 style="color: #374151;">Error:</h4>
          <pre style="background: #1f2937; color: #fca5a5; padding: 16px; border-radius: 6px; overflow-x: auto;">${payload.error}</pre>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
          <p style="color: #9ca3af; font-size: 0.85rem;">Recruiting Automation System — Background Worker</p>
        </div>
      </div>
    `,
    };
}

export async function sendTaskCompletedEmail(payload: {
    taskType: string;
    taskId: string;
    result: Record<string, unknown>;
}): Promise<void> {
    if (env.EMAIL_DELIVERY_MODE === 'preview' || !env.SMTP_HOST || !env.ALERT_EMAIL_TO) {
        logger.debug('EmailService: SMTP not configured — skipping task completed email');
        return;
    }

    try {
        const { subject, html } = taskCompletedTemplate(payload);
        await getTransporter().sendMail({
            from: `"Recruiting Bot 🤖" <${env.SMTP_USER}>`,
            to: env.ALERT_EMAIL_TO,
            subject,
            html,
        });
        logger.info('EmailService: task completed email sent', { taskId: payload.taskId });
    } catch (err) {
        logger.warn('EmailService: failed to send task completed email', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function sendTaskFailedEmail(payload: {
    taskType: string;
    taskId: string;
    error: string;
    attempts: number;
}): Promise<void> {
    if (env.EMAIL_DELIVERY_MODE === 'preview' || !env.SMTP_HOST || !env.ALERT_EMAIL_TO) {
        logger.debug('EmailService: SMTP not configured — skipping task failed email');
        return;
    }

    try {
        const { subject, html } = taskFailedTemplate(payload);
        await getTransporter().sendMail({
            from: `"Recruiting Bot 🤖" <${env.SMTP_USER}>`,
            to: env.ALERT_EMAIL_TO,
            subject,
            html,
        });
        logger.info('EmailService: task failed email sent', { taskId: payload.taskId });
    } catch (err) {
        logger.warn('EmailService: failed to send task failed email', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function sendPublicLeadEmail(payload: {
    type: 'demo' | 'contact';
    name: string;
    email: string;
    company?: string;
    role?: string;
    message: string;
}): Promise<void> {
    if (env.EMAIL_DELIVERY_MODE === 'preview' || !env.SMTP_HOST || !env.ALERT_EMAIL_TO) {
        logger.debug('EmailService: SMTP not configured — skipping public lead email');
        return;
    }

    try {
        const safe = {
            name: escapeHtml(payload.name),
            email: escapeHtml(payload.email),
            company: escapeHtml(payload.company || 'N/A'),
            role: escapeHtml(payload.role || 'N/A'),
            message: escapeHtml(payload.message),
        };

        await getTransporter().sendMail({
            from: `"RecruitAI" <${env.SMTP_USER}>`,
            to: env.ALERT_EMAIL_TO,
            subject:
                payload.type === 'demo'
                    ? `New demo request from ${payload.name}`
                    : `New contact message from ${payload.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                    <h2>New ${payload.type} submission</h2>
                    <p><strong>Name:</strong> ${safe.name}</p>
                    <p><strong>Email:</strong> ${safe.email}</p>
                    <p><strong>Company:</strong> ${safe.company}</p>
                    <p><strong>Role:</strong> ${safe.role}</p>
                    <p><strong>Message:</strong></p>
                    <pre style="white-space: pre-wrap; background: #f3f4f6; padding: 12px; border-radius: 6px;">${safe.message}</pre>
                </div>
            `,
        });
        logger.info('EmailService: public lead email sent', { email: payload.email });
    } catch (err) {
        logger.warn('EmailService: failed to send public lead email', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function sendPasswordResetEmail(payload: {
    email: string;
    name: string;
    resetUrl: string;
}): Promise<void> {
    if (env.EMAIL_DELIVERY_MODE === 'preview' || !env.SMTP_HOST) {
        logger.debug('EmailService: SMTP not configured — skipping password reset email');
        return;
    }

    try {
        await getTransporter().sendMail({
            from: `"RecruitAI" <${env.SMTP_USER}>`,
            to: payload.email,
            subject: 'Reset your RecruitAI password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                    <h2>Password reset requested</h2>
                    <p>Hello ${escapeHtml(payload.name)},</p>
                    <p>Use this link to reset your password. It expires in 30 minutes.</p>
                    <p><a href="${escapeHtml(payload.resetUrl)}">Reset password</a></p>
                    <p>If you did not request this, you can ignore this email.</p>
                </div>
            `,
        });
        logger.info('EmailService: password reset email sent', { email: payload.email });
    } catch (err) {
        logger.warn('EmailService: failed to send password reset email', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
