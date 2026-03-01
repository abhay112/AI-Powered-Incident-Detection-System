import { Resend } from 'resend';
import { AIAnalysis } from '../models/Incident';

let resend: Resend | null = null;

function getResendClient(): Resend | null {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key_here') {
        return null;
    }
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

function severityColor(severity: string): string {
    switch (severity.toLowerCase()) {
        case 'critical': return '#dc2626';
        case 'high': return '#ea580c';
        case 'medium': return '#d97706';
        default: return '#16a34a';
    }
}

function buildIncidentEmail(analysis: AIAnalysis, endpoint: string, githubIssueUrl: string): string {
    const color = severityColor(analysis.severity);
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0f172a;margin:0;padding:32px;font-family:system-ui,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
      <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">AI Incident Detection System</p>
      <h1 style="margin:8px 0 0;font-size:22px;color:#f8fafc;">🚨 New Incident Detected</h1>
    </div>

    <!-- Severity badge -->
    <div style="padding:24px 32px 0;">
      <span style="background:${color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.5px;text-transform:uppercase;">
        ${analysis.severity}
      </span>
      <span style="margin-left:8px;color:#94a3b8;font-size:14px;">Endpoint: <code style="background:#0f172a;padding:2px 6px;border-radius:4px;">${endpoint}</code></span>
    </div>

    <!-- Body -->
    <div style="padding:24px 32px;">

      <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:16px;border-left:3px solid ${color};">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Root Cause</p>
        <p style="margin:0;color:#e2e8f0;font-size:15px;">${analysis.rootCause}</p>
      </div>

      <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Suggested Fix</p>
        <p style="margin:0;color:#e2e8f0;font-size:15px;">${analysis.suggestedFix}</p>
      </div>

      <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Prevention Strategy</p>
        <p style="margin:0;color:#e2e8f0;font-size:15px;">${analysis.preventionStrategy}</p>
      </div>

      <!-- Stats row -->
      <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#0f172a;border-radius:8px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;">Category</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#f1f5f9;">${analysis.category}</p>
          </td>
          <td width="12"></td>
          <td style="padding:12px;background:#0f172a;border-radius:8px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;">AI Confidence</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#10b981;">${analysis.confidence}%</p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      ${githubIssueUrl && !githubIssueUrl.includes('placeholder') ? `
      <a href="${githubIssueUrl}"
         style="display:block;text-align:center;background:#3b82f6;color:#fff;text-decoration:none;
                padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        🐙 View GitHub Issue
      </a>` : ''}
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#0f172a;border-top:1px solid #334155;text-align:center;">
      <p style="margin:0;font-size:12px;color:#475569;">
        Sent by <strong>AI SRE System</strong> · ${new Date().toUTCString()}
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send an incident alert email via Resend.
 * Sends to NOTIFICATION_EMAILS (comma-separated) if configured.
 * Silently skips if RESEND_API_KEY is not set.
 */
export async function sendIncidentEmail(
    analysis: AIAnalysis,
    endpoint: string,
    githubIssueUrl: string
): Promise<void> {
    const client = getResendClient();
    if (!client) {
        console.warn('⚠️  RESEND_API_KEY not set — skipping email notification.');
        return;
    }

    const toRaw = process.env.NOTIFICATION_EMAILS || process.env.NOTIFICATION_EMAIL || '';
    const to = toRaw.split(',').map(e => e.trim()).filter(Boolean);
    if (to.length === 0) {
        console.warn('⚠️  NOTIFICATION_EMAILS not set — skipping email notification.');
        return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const subject = `🚨 [${analysis.severity}] Incident Detected: ${endpoint} (${analysis.confidence}% confidence)`;

    try {
        const result = await client.emails.send({
            from: `AI SRE System <${fromEmail}>`,
            to,
            subject,
            html: buildIncidentEmail(analysis, endpoint, githubIssueUrl),
        });
        console.log(`📧 Incident email sent to ${to.join(', ')} (id: ${result.data?.id})`);
    } catch (err) {
        console.error('❌ Failed to send incident email:', err);
    }
}
