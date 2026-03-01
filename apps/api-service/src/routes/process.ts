import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { httpRequestCounter, httpErrorCounter } from '../metrics';
import { writeErrorLog, writeInfoLog } from '../logger';

const router = Router();

// Realistic business failure scenarios
const FAILURE_SCENARIOS: Record<string, { error: string; stack: string; name: string }> = {
    payment_error: {
        name: 'PaymentGatewayTimeout',
        error: 'External Service Error: Stripe API request timed out after 10000ms',
        stack: `TimeoutError: Stripe Gateway did not respond
    at PaymentService.process (/app/src/services/payment.ts:142:11)
    at async /app/src/routes/process.ts:55:12
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
    },
    inventory_error: {
        name: 'InventoryLockFailure',
        error: 'Database Error: Could not acquire row lock for product ID 4022 (Add to Cart failed)',
        stack: `LockWaitTimeoutError: Lock wait timeout exceeded; try restarting transaction
    at InventoryModel.updateStock (/app/src/models/inventory.ts:88:5)
    at CartService.addItem (/app/src/services/cart.ts:22:9)
    at processRequest (/app/src/routes/process.ts:62:3)`,
    },
    session_error: {
        name: 'CartSessionExpired',
        error: 'Authentication Error: Redis session key "sess:9921" expired during checkout',
        stack: `SessionExpiredError: User session is no longer valid
    at SessionMiddleware.verify (/app/src/middleware/auth.ts:12:33)
    at processRequest (/app/src/routes/process.ts:45:5)`,
    },
};

// Set to 0 to prevent accidental background incidents
// Incidents will only be triggered when manually requested
const FAILURE_RATE = 0;

router.post('/', (req: Request, res: Response) => {
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();
    const payload = req.body;

    // Check if a specific failure is being forced (e.g., /process?forceFailure=payment_error)
    const forcedType = req.query.forceFailure as string;
    const shouldFail = (Math.random() < FAILURE_RATE) || !!forcedType;

    if (shouldFail) {
        const scenarioKey = forcedType && FAILURE_SCENARIOS[forcedType]
            ? forcedType
            : Object.keys(FAILURE_SCENARIOS)[Math.floor(Math.random() * Object.keys(FAILURE_SCENARIOS).length)];

        const scenario = FAILURE_SCENARIOS[scenarioKey];

        httpErrorCounter.inc({ method: 'POST', route: '/process' });
        httpRequestCounter.inc({ method: 'POST', route: '/process', status_code: '500' });

        writeErrorLog({
            timestamp,
            level: 'ERROR',
            endpoint: '/process',
            method: 'POST',
            requestId,
            payload,
            error: scenario.error,
            stackTrace: scenario.stack,
        });

        return res.status(500).json({
            status: 'error',
            requestId,
            timestamp,
            error: scenario.error,
            errorType: scenario.name,
            message: `Service failure: ${scenario.name}`,
        });
    }

    httpRequestCounter.inc({ method: 'POST', route: '/process', status_code: '200' });

    writeInfoLog({
        timestamp,
        endpoint: '/process',
        method: 'POST',
        requestId,
        payload,
    });

    return res.status(200).json({
        status: 'success',
        requestId,
        timestamp,
        message: 'Request processed successfully',
        result: {
            processed: true,
            receivedPayload: payload,
            processedAt: timestamp,
        },
    });
});

export default router;
