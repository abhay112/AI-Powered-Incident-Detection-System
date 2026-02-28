import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import webhookRouter from './routes/webhook';
import incidentsRouter from './routes/incidents';

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/incidents';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/incidents', incidentsRouter);

// Root info
app.get('/', (_req: Request, res: Response) => {
    res.json({
        service: 'incident-service',
        version: '1.0.0',
        endpoints: [
            'POST /webhook/alert',
            'GET /incidents',
            'GET /incidents/:id',
            'POST /incidents/:id/reanalyze',
            'PATCH /incidents/:id/resolve',
        ],
        status: 'running',
    });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        status: 'healthy',
        database: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Connect to MongoDB then start server
async function startServer() {
    let retries = 5;
    while (retries > 0) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log('✅ Connected to MongoDB');
            break;
        } catch (err) {
            retries--;
            console.error(`❌ MongoDB connection failed. Retries left: ${retries}`, err);
            if (retries === 0) {
                console.error('💀 Could not connect to MongoDB. Exiting.');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    app.listen(PORT, () => {
        console.log(`🚀 Incident Service running on port ${PORT}`);
        console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/alert`);
        console.log(`📋 Incidents API: http://localhost:${PORT}/incidents`);
    });
}

startServer();

export default app;
