import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// HTTP request counter
export const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

// Error counter
export const httpErrorCounter = new client.Counter({
    name: 'http_errors_total',
    help: 'Total number of HTTP errors (5xx)',
    labelNames: ['method', 'route'],
    registers: [register],
});

// Request duration histogram
export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

// Health status gauge (1 = healthy, 0 = unhealthy)
export const healthStatusGauge = new client.Gauge({
    name: 'api_health_status',
    help: 'Current health status of the API (1=healthy, 0=unhealthy)',
    registers: [register],
});

// Initialize health as healthy
healthStatusGauge.set(1);

export { register };
