import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { incidentApi, simulateApi } from '../api/client';
import { Incident } from '../types';
import IncidentTable from '../components/IncidentTable';
import { ToastContainer, Toast } from '../components/Toast';

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function IncidentList() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [triggering, setTriggering] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const addToast = (type: Toast['type'], message: string, icon: string) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message, icon }]);
    };

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const fetchIncidents = useCallback(async () => {
        try {
            const response = await incidentApi.getAll();
            setIncidents(response.data.sort((a, b) => {
                const severityDiff = SEVERITY_ORDER[a.aiAnalysis.severity] - SEVERITY_ORDER[b.aiAnalysis.severity];
                if (severityDiff !== 0) return severityDiff;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }));
            setError(null);
        } catch (err) {
            setError('Failed to connect to incident service. Is it running? Check docker-compose.');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIncidents();
    }, [fetchIncidents]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchIncidents, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchIncidents]);

    const handleTriggerFailure = async (type: 'payment_error' | 'inventory_error' | 'session_error') => {
        setTriggering(true);
        const label = type === 'payment_error' ? 'Payment' : type === 'inventory_error' ? 'Add to Cart' : 'Session';
        addToast('info', `Simulating ${label} failure and firing incident pipeline...`, '🚦');

        try {
            // 1. Fire the specific process failure (generates real error logs in api-service)
            const apiServiceUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_SERVICE_URL || 'http://localhost:3000';
            await axios.post(`${apiServiceUrl}/process?forceFailure=${type}`, {
                simulatedRequest: true,
                userId: Math.floor(Math.random() * 1000),
                type,
                timestamp: new Date().toISOString(),
            }).catch(() => { }); // Expected to fail with 500

            // 2. Directly fire the webhook → OpenAI analysis → GitHub issue
            await simulateApi.triggerWebhook(type);

            addToast('success', `${label} failure triggered! AI is analyzing. Refreshing in 5s...`, '✅');

            // 3. Auto-refresh
            setTimeout(fetchIncidents, 5000);
            setTimeout(fetchIncidents, 12000);
        } catch {
            addToast('error', 'Could not reach incident service.', '❌');
        } finally {
            setTriggering(false);
        }
    };

    const filteredIncidents = incidents.filter(i =>
        filter === 'ALL' ? true : i.status === filter
    );

    const stats = {
        total: incidents.length,
        open: incidents.filter(i => i.status === 'OPEN').length,
        critical: incidents.filter(i => i.aiAnalysis.severity === 'Critical').length,
        avgConfidence: incidents.length
            ? Math.round(incidents.reduce((s, i) => s + i.aiAnalysis.confidence, 0) / incidents.length)
            : 0,
    };

    return (
        <>
            <ToastContainer toasts={toasts} onRemove={removeToast} />

            <div className="page-header">
                <h1 className="page-title">Incident Command Center</h1>
                <p className="page-subtitle">
                    Real-time AI-assisted incident detection, analysis, and resolution
                </p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>📊</div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{stats.total}</div>
                        <div className="stat-label">Total Incidents</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>🔓</div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: 'var(--status-open)' }}>{stats.open}</div>
                        <div className="stat-label">Open Incidents</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>🔴</div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: 'var(--severity-critical)' }}>{stats.critical}</div>
                        <div className="stat-label">Critical</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)' }}>🤖</div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>{stats.avgConfidence}%</div>
                        <div className="stat-label">Avg AI Confidence</div>
                    </div>
                </div>
            </div>

            {/* Trigger Panel */}
            <div className="trigger-panel">
                <div className="trigger-panel-text">
                    <h3>🧪 Failure Simulator</h3>
                    <p>Trigger simulated API failures to test the full incident pipeline end-to-end</p>
                </div>
                <div className="trigger-actions">
                    <button
                        id="trigger-cart-failure"
                        className="btn btn-warning"
                        onClick={() => handleTriggerFailure('inventory_error')}
                        disabled={triggering}
                    >
                        🛒 Add to Cart Fail
                    </button>
                    <button
                        id="trigger-payment-failure"
                        className="btn btn-danger"
                        onClick={() => handleTriggerFailure('payment_error')}
                        disabled={triggering}
                    >
                        💳 Payment Fail
                    </button>
                    <button
                        id="refresh-btn"
                        className="btn btn-secondary btn-sm"
                        onClick={fetchIncidents}
                        aria-label="Refresh incidents"
                    >
                        🔄 Refresh
                    </button>
                    <button
                        id="auto-refresh-toggle"
                        className={`btn btn-sm ${autoRefresh ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setAutoRefresh(v => !v)}
                        aria-label={autoRefresh ? 'Disable auto refresh' : 'Enable auto refresh'}
                    >
                        {autoRefresh ? '⏸ Auto' : '▶ Auto'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner" role="alert">
                    ⚠️ {error}
                </div>
            )}

            {/* Filter Tabs + Table */}
            <div>
                <div className="section-header">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
                            <button
                                key={f}
                                id={`filter-${f.toLowerCase()}`}
                                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilter(f)}
                                aria-pressed={filter === f}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <span className="section-count">{filteredIncidents.length} incidents</span>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner spinner-lg" aria-label="Loading incidents" />
                        <span>Connecting to incident service...</span>
                    </div>
                ) : filteredIncidents.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛡️</div>
                        <div className="empty-state-title">No incidents detected</div>
                        <div className="empty-state-subtitle">
                            {filter !== 'ALL'
                                ? `No ${filter.toLowerCase()} incidents found.`
                                : 'Use the Failure Simulator above or wait for Prometheus to detect an issue.'}
                        </div>
                    </div>
                ) : (
                    <IncidentTable incidents={filteredIncidents} />
                )}
            </div>
        </>
    );
}
