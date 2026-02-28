import { Router, Request, Response } from 'express';
import { Incident } from '../models/Incident';
import { collectIncidentContext } from '../services/contextCollector';
import { analyzeIncident } from '../services/aiAnalyzer';
import { createGitHubIssue } from '../services/githubService';

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

export default router;
