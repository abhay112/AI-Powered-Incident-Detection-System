import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Incident } from '../models/Incident';
import { collectIncidentContext } from '../services/contextCollector';
import { analyzeIncident } from '../services/aiAnalyzer';
import { createGitHubIssue } from '../services/githubService';
import { sendIncidentEmail } from '../services/emailService';

const router = Router();

interface GrafanaAlert {
    status: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    startsAt?: string;
}

interface WebhookPayload {
    alerts?: GrafanaAlert[];
    status?: string;
    message?: string;
}

// ─── Deduplication guard ──────────────────────────────────────────────────────
// Prevents calling OpenAI/GitHub multiple times if Grafana retries the same alert.
// Each fingerprint is kept for 2 minutes, then auto-cleaned.
const recentAlerts = new Set<string>();

function makeFingerprint(body: WebhookPayload): string {
    const alert = body.alerts?.[0];
    const alertName = alert?.labels?.alertname || body.status || 'unknown';
    const minuteBucket = Math.floor(Date.now() / (2 * 60 * 1000)); // 2-min window
    return `${alertName}-${minuteBucket}`;
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /webhook/alert
 * Receives Grafana alert webhooks and kicks off the incident pipeline
 */
router.post('/alert', async (req: Request, res: Response) => {
    const body = req.body as WebhookPayload;

    // ── Deduplication check ──────────────────────────────────────────────────
    const fingerprint = makeFingerprint(body);
    if (recentAlerts.has(fingerprint)) {
        console.log(`⏭️  Duplicate alert ignored (${fingerprint}) — skipping OpenAI call`);
        return res.status(200).json({ received: true, message: 'Duplicate alert ignored — already processing this incident.' });
    }
    recentAlerts.add(fingerprint);
    setTimeout(() => recentAlerts.delete(fingerprint), 2 * 60 * 1000); // clean up after 2 min
    // ────────────────────────────────────────────────────────────────────────

    console.log('📨 Received webhook alert:', JSON.stringify(body, null, 2));

    // Acknowledge immediately so Grafana doesn't retry
    res.status(200).json({ received: true, message: 'Alert acknowledged, processing incident...' });

    // Process asynchronously to avoid timeout
    setImmediate(async () => {
        try {
            const alertId = uuidv4();
            const timestamp = new Date();

            console.log('🔍 Step 1: Collecting incident context...');
            const incidentType = body.alerts?.[0]?.labels?.incident_type;
            const { logs, commitDiff, payload, endpoint } = collectIncidentContext(incidentType);

            console.log('🤖 Step 2: Sending context to AI for analysis...');
            const aiAnalysis = await analyzeIncident(logs, commitDiff, payload);
            console.log('✅ AI Analysis complete:', aiAnalysis);

            console.log('🐙 Step 3: Creating GitHub issue...');
            let githubIssueUrl = '';
            try {
                githubIssueUrl = await createGitHubIssue(aiAnalysis, endpoint, logs, commitDiff);
            } catch (ghError) {
                console.warn('⚠️ GitHub issue creation failed:', ghError);
                githubIssueUrl = 'https://github.com/placeholder/issue/0';
            }

            console.log('💾 Step 4: Saving incident to MongoDB...');
            const incident = new Incident({
                alertId,
                endpoint,
                timestamp,
                logs,
                commitDiff,
                payload,
                aiAnalysis,
                githubIssueUrl,
                status: 'OPEN',
            });

            await incident.save();
            console.log(`✅ Incident ${alertId} saved to database`);

            console.log('📧 Step 5: Sending email notification...');
            sendIncidentEmail(aiAnalysis, endpoint, githubIssueUrl).catch(err =>
                console.error('Email notification failed (non-critical):', err)
            );

        } catch (error) {
            console.error('❌ Error processing incident:', error);
        }
    });
});

export default router;
