import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { register } from './metrics';
import { httpRequestCounter, httpRequestDuration } from './metrics';
import healthRouter from './routes/health';
import processRouter from './routes/process';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow any origin so the React dashboard can talk to this service
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request timing middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration.observe(
            { method: req.method, route: req.path, status_code: String(res.statusCode) },
            duration
        );
    });
    next();
});

// Routes
app.use('/health', healthRouter);
app.use('/process', processRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (err) {
        res.status(500).end(err);
    }
});

// Root info endpoint
app.get('/', (_req: Request, res: Response) => {
    res.json({
        service: 'api-service',
        version: '1.0.0',
        endpoints: ['/health', '/process', '/metrics'],
        description: 'Simulated unstable API for incident detection testing',
    });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 API Service running on port ${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
    console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

export default app;
