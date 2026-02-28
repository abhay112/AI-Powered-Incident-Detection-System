import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { httpRequestCounter, httpErrorCounter } from '../metrics';
import { writeErrorLog, writeInfoLog } from '../logger';

const router = Router();

// Simulate different types of failures
const FAILURE_SCENARIOS = [
    {
        name: 'NullPointerException',
        error: 'Cannot read property "id" of undefined',
        stack: `TypeError: Cannot read property 'id' of undefined
    at processUserData (/app/src/services/userService.ts:45:23)
    at async processRequest (/app/src/routes/process.ts:32:5)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
    },
    {
        name: 'DatabaseConnectionError',
        error: 'MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017',
        stack: `MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1148:16)
    at connectToFirstAvailable (/app/node_modules/mongoose/lib/connection.js:784:12)
    at processRequest (/app/src/routes/process.ts:45:5)`,
    },
    {
        name: 'ValidationError',
        error: 'ValidationError: "amount" must be a positive number',
        stack: `ValidationError: "amount" must be a positive number
    at Object.validate (/app/src/validators/paymentValidator.ts:23:11)
    at validatePayload (/app/src/middleware/validation.ts:15:5)
    at processRequest (/app/src/routes/process.ts:28:3)`,
    },
    {
        name: 'TimeoutError',
        error: 'Request timeout: downstream service did not respond within 5000ms',
        stack: `TimeoutError: Request timeout: downstream service did not respond within 5000ms
    at Timeout._onTimeout (/app/src/services/httpClient.ts:67:13)
    at listOnTimeout (internal/timers.js:554:17)
    at processTimers (internal/timers.js:497:7)`,
    },
];

// Simulate failure: ~40% chance on process endpoint
const FAILURE_RATE = 0.4;

router.post('/', (req: Request, res: Response) => {
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();
    const payload = req.body;
    const shouldFail = Math.random() < FAILURE_RATE;

    if (shouldFail) {
        const scenario = FAILURE_SCENARIOS[Math.floor(Math.random() * FAILURE_SCENARIOS.length)];

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
            message: 'Request processing failed due to an internal error',
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
