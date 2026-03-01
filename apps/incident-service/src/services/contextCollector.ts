import fs from 'fs';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

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
 * Collects relevant context for an incident.
 * In a real system, this would pull from:
 * 1. ELK/Splunk for recent logs
 * 2. GitHub/GitLab for recent commits
 * 3. Prometheus/Grafana for metric snapshots
 */
export function collectIncidentContext(type?: string) {
    let logs = '';
    let commitDiff = '';
    let endpoint = '/process';

    if (type === 'payment_error') {
        endpoint = '/payment/process';
        logs = `
2026-03-01T07:15:01.234Z INFO [PaymentService] Initiating charge for Order #ORD-9921 (Amount: $54.00)
2026-03-01T07:15:01.455Z DEBUG [StripeClient] POST https://api.stripe.com/v1/charges
2026-03-01T07:15:11.456Z ERROR [StripeClient] Request timed out after 10000ms
2026-03-01T07:15:11.457Z WARN [PaymentService] Gateway timeout, retrying... (Attempt 1/3)
2026-03-01T07:15:21.458Z ERROR [StripeClient] Request timed out after 10000ms
2026-03-01T07:15:21.459Z ERROR [PaymentService] Payment processing failed: Stripe API Timeout`;
        commitDiff = `
diff --git a/apps/api-service/src/services/stripe.ts b/apps/api-service/src/services/stripe.ts
--- a/apps/api-service/src/services/stripe.ts
+++ b/apps/api-service/src/services/stripe.ts
@@ -10,1 +10,1 @@
-const TIMEOUT = 30000;
+const TIMEOUT = 10000; // Reduced timeout to "improve performance"`;
    } else if (type === 'inventory_error') {
        endpoint = '/cart/add';
        logs = `
2026-03-01T07:16:12.111Z INFO [CartService] User 442 adding Product 4022 to cart
2026-03-01T07:16:12.125Z DEBUG [InventoryDB] SELECT * FROM inventory WHERE product_id = 4022 FOR UPDATE
2026-03-01T07:16:42.126Z ERROR [InventoryDB] Lock wait timeout exceeded; try restarting transaction
2026-03-01T07:16:42.127Z ERROR [CartService] Could not reserve stock for Product 4022. Abandoning Add to Cart.`;
        commitDiff = `
diff --git a/apps/api-service/src/models/inventory.ts b/apps/api-service/src/models/inventory.ts
--- a/apps/api-service/src/models/inventory.ts
+++ b/apps/api-service/src/models/inventory.ts
@@ -45,3 +45,3 @@
-async function updateStock(id) {
-  return db.transaction(async (tx) => {
+async function updateStock(id) {
+  // Removed transaction wrapper to "simplify" code
+  // Wait, this might cause race conditions or orphan locks
`;
    } else if (type === 'session_error') {
        endpoint = '/auth/verify';
        logs = `
2026-03-01T07:17:05.101Z DEBUG [Redis] GET sess:9921
2026-03-01T07:17:05.102Z INFO [SessionManager] Key "sess:9921" not found or expired
2026-03-01T07:17:05.103Z WARN [AuthMiddleware] Session expired for user 442 during checkout flow`;
        commitDiff = `
diff --git a/apps/api-service/src/config/redis.ts b/apps/api-service/src/config/redis.ts
--- a/apps/api-service/src/config/redis.ts
+++ b/apps/api-service/src/config/redis.ts
@@ -5,1 +5,1 @@
-export const SESSION_TTL = 3600; // 1 hour
+export const SESSION_TTL = 60;   // 1 minute (testing value leaked to prod?)`;
    } else {
        // Fallback for generic health check alerts
        logs = `
2026-03-01T06:45:01.000Z INFO [api-service] Incoming request GET /health
2026-03-01T06:45:01.005Z ERROR [api-service] Health check failed: downsteam service unavailable
2026-03-01T06:45:01.008Z WARN [api-service] Circuit breaker opened for 'auth-provider'`;
        commitDiff = `
diff --git a/apps/api-service/src/routes/health.ts b/apps/api-service/src/routes/health.ts
--- a/apps/api-service/src/routes/health.ts
+++ b/apps/api-service/src/routes/health.ts
@@ -12,1 +12,1 @@
-if (authStatus !== 'ok')
+if (authStatus !== 'ok' && !process.env.SKIP_AUTH_CHECK)`;
    }

    return {
        logs,
        commitDiff,
        payload: {
            requestId: uuidv4(),
            timestamp: new Date().toISOString(),
            incidentType: type || 'health_check'
        },
        endpoint
    };
}
