import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Incident } from '../models/Incident';
import { collectIncidentContext } from '../services/contextCollector';
import { analyzeIncident } from '../services/aiAnalyzer';
import { createGitHubIssue } from '../services/githubService';

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

/**
 * POST /webhook/alert
 * Receives Grafana alert webhooks and kicks off the incident pipeline
 */
router.post('/alert', async (req: Request, res: Response) => {
    const body = req.body as WebhookPayload;
    console.log('📨 Received webhook alert:', JSON.stringify(body, null, 2));

    // Acknowledge immediately so Grafana doesn't retry
    res.status(200).json({ received: true, message: 'Alert acknowledged, processing incident...' });

    // Process asynchronously to avoid timeout
    setImmediate(async () => {
        try {
            const alertId = uuidv4();
            const timestamp = new Date();

            console.log('🔍 Step 1: Collecting incident context...');
            const { logs, commitDiff, payload, endpoint } = collectIncidentContext();

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

        } catch (error) {
            console.error('❌ Error processing incident:', error);
        }
    });
});

export default router;
