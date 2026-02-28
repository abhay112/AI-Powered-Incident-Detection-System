import fs from 'fs';
import { execSync } from 'child_process';

const LOG_FILE = '/logs/error.log';
const MAX_LOG_LINES = 50;

export interface CollectedContext {
    logs: string;
    commitDiff: string;
    payload: Record<string, unknown>;
    endpoint: string;
    stackTrace: string;
}

/**
 * Read the last N lines of the error log file
 */
export function readLastLogLines(lines: number = MAX_LOG_LINES): string {
    if (!fs.existsSync(LOG_FILE)) {
        return 'No log file found at ' + LOG_FILE;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const allLines = content.split('\n').filter(Boolean);
    const lastLines = allLines.slice(-lines);
    return lastLines.join('\n');
}

/**
 * Extract the last error payload, stack trace, and endpoint from logs
 */
export function extractLastErrorContext(rawLogs: string): {
    payload: Record<string, unknown>;
    stackTrace: string;
    endpoint: string;
} {
    const logLines = rawLogs.split('\n').filter(Boolean);

    let payload: Record<string, unknown> = {};
    let stackTrace = '';
    let endpoint = '/unknown';

    // Parse log lines in reverse to find the most recent error
    for (let i = logLines.length - 1; i >= 0; i--) {
        try {
            const entry = JSON.parse(logLines[i]);
            if (entry.level === 'ERROR') {
                payload = (entry.payload as Record<string, unknown>) || {};
                stackTrace = entry.stackTrace || entry.error || '';
                endpoint = entry.endpoint || '/unknown';
                break;
            }
        } catch {
            // skip non-JSON lines
        }
    }

    return { payload, stackTrace, endpoint };
}

/**
 * Get the latest git commit diff
 */
export function getLatestCommitDiff(): string {
    try {
        const diff = execSync('git log -p -1 --no-color', {
            cwd: '/app',
            timeout: 10000,
            encoding: 'utf8',
        });
        return diff.substring(0, 5000); // limit size
    } catch (error) {
        console.warn('Could not get git diff:', error);
        return 'Unable to retrieve git diff. Git repository may not be initialized.';
    }
}

/**
 * Collect all context needed for AI analysis
 */
export function collectIncidentContext(): CollectedContext {
    const rawLogs = readLastLogLines(MAX_LOG_LINES);
    const { payload, stackTrace, endpoint } = extractLastErrorContext(rawLogs);
    const commitDiff = getLatestCommitDiff();

    return {
        logs: rawLogs,
        commitDiff,
        payload,
        endpoint,
        stackTrace,
    };
}
