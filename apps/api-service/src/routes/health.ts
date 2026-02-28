import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { httpRequestCounter, httpErrorCounter, healthStatusGauge } from '../metrics';
import { writeErrorLog, writeInfoLog } from '../logger';

const router = Router();

// Simulate failure rate: ~30% chance of failure
const FAILURE_RATE = 0.3;

router.get('/', (req: Request, res: Response) => {
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();
    const shouldFail = Math.random() < FAILURE_RATE;

    if (shouldFail) {
        const error = new Error('Health check failed: Service degraded due to high memory pressure');

        httpErrorCounter.inc({ method: 'GET', route: '/health' });
        httpRequestCounter.inc({ method: 'GET', route: '/health', status_code: '500' });
        healthStatusGauge.set(0);

        writeErrorLog({
            timestamp,
            level: 'ERROR',
            endpoint: '/health',
            method: 'GET',
            requestId,
            error: error.message,
            stackTrace: error.stack,
        });

        return res.status(500).json({
            status: 'unhealthy',
            requestId,
            timestamp,
            message: error.message,
            error: 'Service is currently degraded',
        });
    }

    // Reset health to OK
    healthStatusGauge.set(1);
    httpRequestCounter.inc({ method: 'GET', route: '/health', status_code: '200' });

    writeInfoLog({
        timestamp,
        endpoint: '/health',
        method: 'GET',
        requestId,
    });

    return res.status(200).json({
        status: 'healthy',
        requestId,
        timestamp,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});

export default router;
