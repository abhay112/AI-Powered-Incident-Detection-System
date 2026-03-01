import { Router, Request, Response } from 'express';
import { Incident } from '../models/Incident';
import { collectIncidentContext } from '../services/contextCollector';
import { analyzeIncident } from '../services/aiAnalyzer';
import { createGitHubIssue, closeGitHubIssue } from '../services/githubService';

const router = Router();

/**
 * GET /incidents
 * Returns all incidents, sorted by newest first
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const incidents = await Incident.find().sort({ timestamp: -1 }).lean();
        res.json({ success: true, count: incidents.length, data: incidents });
    } catch (error) {
        console.error('Error fetching incidents:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
    }
});

/**
 * GET /incidents/:id
 * Returns a specific incident by MongoDB ID
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const incident = await Incident.findById(req.params.id).lean();
        if (!incident) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }
        return res.json({ success: true, data: incident });
    } catch (error) {
        console.error('Error fetching incident:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch incident' });
    }
});

/**
 * POST /incidents/:id/reanalyze
 * Re-runs AI analysis on an existing incident with the same context
 */
router.post('/:id/reanalyze', async (req: Request, res: Response) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }

        console.log(`🔄 Re-analyzing incident ${incident.alertId}`);

        // Collect fresh context
        const { logs, commitDiff, payload } = collectIncidentContext();

        // Re-run AI analysis
        const newAnalysis = await analyzeIncident(logs, commitDiff, payload);

        // Create a new GitHub issue for the re-analysis
        let githubIssueUrl = incident.githubIssueUrl;
        try {
            githubIssueUrl = await createGitHubIssue(
                newAnalysis,
                incident.endpoint,
                logs,
                commitDiff
            );
        } catch (ghError) {
            console.warn('GitHub issue creation failed during reanalysis:', ghError);
        }

        // Update the incident
        incident.aiAnalysis = newAnalysis;
        incident.logs = logs;
        incident.commitDiff = commitDiff;
        incident.githubIssueUrl = githubIssueUrl;
        await incident.save();

        return res.json({
            success: true,
            message: 'Re-analysis complete',
            data: incident.toObject(),
        });
    } catch (error) {
        console.error('Error re-analyzing incident:', error);
        return res.status(500).json({ success: false, error: 'Failed to re-analyze incident' });
    }
});

/**
 * PATCH /incidents/:id/resolve
 * Marks an incident as RESOLVED
 */
router.patch('/:id/resolve', async (req: Request, res: Response) => {
    try {
        const incident = await Incident.findByIdAndUpdate(
            req.params.id,
            { status: 'RESOLVED' },
            { new: true }
        ).lean();

        if (!incident) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }

        // Close the linked GitHub issue in the background (don't block the response)
        const issueUrl = (incident as { githubIssueUrl?: string }).githubIssueUrl;
        if (issueUrl) {
            closeGitHubIssue(issueUrl).catch(err =>
                console.error('Failed to close GitHub issue:', err)
            );
        }

        return res.json({
            success: true,
            message: 'Incident marked as RESOLVED',
            data: incident,
        });
    } catch (error) {
        console.error('Error resolving incident:', error);
        return res.status(500).json({ success: false, error: 'Failed to resolve incident' });
    }
});

/**
 * DELETE /incidents/all
 * Wipes all incidents — use to clear mock data and start fresh.
 */
router.delete('/all', async (_req: Request, res: Response) => {
    try {
        const result = await Incident.deleteMany({});
        return res.json({ success: true, deleted: result.deletedCount, message: 'All incidents cleared.' });
    } catch (error) {
        console.error('Error clearing incidents:', error);
        return res.status(500).json({ success: false, error: 'Failed to clear incidents' });
    }
});

/**
 * POST /incidents/reanalyze-all
 * Re-runs real AI analysis on every incident in the database.
 * Useful after setting OPENAI_API_KEY when incidents were originally saved with mock data.
 */
router.post('/reanalyze-all', async (_req: Request, res: Response) => {
    try {
        const incidents = await Incident.find().sort({ timestamp: -1 });
        res.json({
            success: true,
            message: `Re-analyzing ${incidents.length} incidents in the background. Check logs for progress.`,
            count: incidents.length,
        });

        // Process sequentially in background to avoid rate-limiting OpenAI
        setImmediate(async () => {
            let success = 0;
            let failed = 0;
            for (const incident of incidents) {
                try {
                    console.log(`🔄 Re-analyzing ${incident.alertId} (${success + failed + 1}/${incidents.length})...`);
                    const { logs, commitDiff, payload } = collectIncidentContext();
                    const newAnalysis = await analyzeIncident(logs, commitDiff, payload);

                    // Create a GitHub issue for each re-analyzed incident
                    let githubIssueUrl = incident.githubIssueUrl;
                    try {
                        githubIssueUrl = await createGitHubIssue(newAnalysis, incident.endpoint, logs, commitDiff);
                        console.log(`🐙 GitHub issue created: ${githubIssueUrl}`);
                    } catch (ghErr) {
                        console.warn(`⚠️ GitHub issue skipped for ${incident.alertId}:`, ghErr);
                    }

                    incident.aiAnalysis = newAnalysis;
                    incident.logs = logs;
                    incident.commitDiff = commitDiff;
                    incident.githubIssueUrl = githubIssueUrl;
                    await incident.save();
                    success++;
                    console.log(`✅ Done: ${incident.alertId} → severity=${newAnalysis.severity}, confidence=${newAnalysis.confidence}`);
                    // Small delay to be kind to OpenAI + GitHub rate limits
                    await new Promise(r => setTimeout(r, 800));
                } catch (err) {
                    failed++;
                    console.error(`❌ Failed to re-analyze ${incident.alertId}:`, err);
                }
            }
            console.log(`🏁 Bulk re-analysis complete: ${success} succeeded, ${failed} failed`);
        });
    } catch (error) {
        console.error('Error starting bulk re-analysis:', error);
        res.status(500).json({ success: false, error: 'Failed to start bulk re-analysis' });
    }
});

export default router;
