import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { incidentApi } from '../api/client';
import { Incident } from '../types';
import Collapsible from '../components/Collapsible';
import { ToastContainer, Toast } from '../components/Toast';
import { formatDistanceToNow, format } from 'date-fns';

function SeverityBadge({ severity }: { severity: Incident['aiAnalysis']['severity'] }) {
    const icons: Record<string, string> = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };
    return (
        <span className={`badge badge-${severity.toLowerCase()}`}>
            {icons[severity]} {severity}
        </span>
    );
}

function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
        'Network': '#3b82f6',
        'Code regression': '#f97316',
        'Validation error': '#eab308',
        'Infrastructure': '#ef4444',
    };
    return (
        <span
            className="badge"
            style={{
                color: colors[category] || 'var(--text-secondary)',
                background: `${colors[category] || '#fff'}15`,
                border: `1px solid ${colors[category] || '#fff'}30`,
            }}
        >
            {category}
        </span>
    );
}

export default function IncidentDetail() {
    const { id } = useParams<{ id: string }>();
    const [incident, setIncident] = useState<Incident | null>(null);
    const [loading, setLoading] = useState(true);
    const [reanalyzing, setReanalyzing] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [error, setError] = useState<string | null>(null);

    const addToast = (type: Toast['type'], message: string, icon: string) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message, icon }]);
    };

    const removeToast = useCallback((toastId: string) => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
    }, []);

    const fetchIncident = useCallback(async () => {
        if (!id) return;
        try {
            const response = await incidentApi.getById(id);
            setIncident(response.data);
            setError(null);
        } catch {
            setError('Incident not found or service unavailable.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchIncident();
    }, [fetchIncident]);

    const handleReanalyze = async () => {
        if (!id) return;
        setReanalyzing(true);
        addToast('info', 'Re-running AI analysis...', '🤖');
        try {
            const response = await incidentApi.reanalyze(id);
            setIncident(response.data);
            addToast('success', 'Re-analysis complete! AI has updated the incident.', '✅');
        } catch {
            addToast('error', 'Re-analysis failed. Check incident service logs.', '❌');
        } finally {
            setReanalyzing(false);
        }
    };

    const handleResolve = async () => {
        if (!id || incident?.status === 'RESOLVED') return;
        setResolving(true);
        try {
            const response = await incidentApi.resolve(id);
            setIncident(response.data);
            addToast('success', 'Incident marked as RESOLVED!', '✅');
        } catch {
            addToast('error', 'Failed to resolve incident.', '❌');
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner spinner-lg" aria-label="Loading incident details" />
                <span>Loading incident details...</span>
            </div>
        );
    }

    if (error || !incident) {
        return (
            <div>
                <Link to="/" className="back-link">← Back to Incidents</Link>
                <div className="error-banner" role="alert">⚠️ {error || 'Incident not found'}</div>
            </div>
        );
    }

    const analysis = incident.aiAnalysis;
    const confidenceColor = analysis.confidence >= 80
        ? 'var(--severity-low)'
        : analysis.confidence >= 60
            ? 'var(--severity-medium)'
            : 'var(--severity-high)';

    return (
        <>
            <ToastContainer toasts={toasts} onRemove={removeToast} />

            <Link to="/" className="back-link" aria-label="Back to incident list">← Back to Incidents</Link>

            {/* Header */}
            <div className="detail-header">
                <div className="detail-title-group">
                    <h1>
                        Incident: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--text-accent)' }}>
                            {incident.endpoint}
                        </code>
                    </h1>
                    <div className="detail-meta">
                        <SeverityBadge severity={analysis.severity} />
                        <CategoryBadge category={analysis.category} />
                        <span className={`badge badge-${incident.status.toLowerCase()}`}>
                            {incident.status === 'OPEN' ? '● OPEN' : '✓ RESOLVED'}
                        </span>
                    </div>
                </div>

                <div className="detail-actions">
                    <button
                        id="reanalyze-btn"
                        className="btn btn-secondary"
                        onClick={handleReanalyze}
                        disabled={reanalyzing}
                        aria-label="Re-analyze incident with AI"
                    >
                        {reanalyzing ? (
                            <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing...</>
                        ) : (
                            '🔄 Re-analyze'
                        )}
                    </button>
                    <button
                        id="resolve-btn"
                        className="btn btn-success"
                        onClick={handleResolve}
                        disabled={resolving || incident.status === 'RESOLVED'}
                        aria-label="Mark incident as resolved"
                    >
                        {resolving ? (
                            <><span className="spinner" style={{ width: 14, height: 14 }} /> Resolving...</>
                        ) : incident.status === 'RESOLVED' ? (
                            '✓ Resolved'
                        ) : (
                            '✅ Mark Resolved'
                        )}
                    </button>
                    {incident.githubIssueUrl && incident.githubIssueUrl !== 'https://github.com/placeholder/issue/0' && (
                        <a
                            id="github-issue-link"
                            href={incident.githubIssueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            aria-label="View GitHub issue"
                        >
                            🐙 GitHub Issue
                        </a>
                    )}
                </div>
            </div>

            {/* Two-column layout */}
            <div className="detail-layout">
                {/* Main analysis content */}
                <div>
                    <div className="analysis-grid">
                        <div className="analysis-item">
                            <div className="analysis-item-label">🔍 Root Cause</div>
                            <div className="analysis-item-value">{analysis.rootCause}</div>
                        </div>
                        <div className="analysis-item">
                            <div className="analysis-item-label">🛠 Suggested Fix</div>
                            <div className="analysis-item-value">{analysis.suggestedFix}</div>
                        </div>
                        <div className="analysis-item">
                            <div className="analysis-item-label">🛡 Prevention Strategy</div>
                            <div className="analysis-item-value">{analysis.preventionStrategy}</div>
                        </div>
                    </div>

                    {/* Logs */}
                    <Collapsible title="Error Logs" icon="📋">
                        <pre className="code-block">{incident.logs || 'No logs available'}</pre>
                    </Collapsible>

                    {/* Commit Diff */}
                    <Collapsible title="Recent Commit Diff" icon="📦">
                        <pre className="code-block">{incident.commitDiff || 'No commit diff available'}</pre>
                    </Collapsible>

                    {/* Payload */}
                    <Collapsible title="API Request Payload" icon="📤">
                        <pre className="code-block">{JSON.stringify(incident.payload, null, 2)}</pre>
                    </Collapsible>
                </div>

                {/* Sidebar */}
                <div className="sidebar">
                    {/* Confidence Score */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title">AI Analysis Confidence</div>
                        <div className="confidence-ring-container">
                            <div
                                className="confidence-ring-value"
                                style={{ color: confidenceColor }}
                            >
                                {analysis.confidence}%
                            </div>
                            <div style={{ width: '100%', height: 8, background: 'var(--bg-elevated)', borderRadius: 100, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${analysis.confidence}%`,
                                        background: `linear-gradient(90deg, ${confidenceColor}, ${confidenceColor}80)`,
                                        borderRadius: 100,
                                        transition: 'width 1s ease',
                                    }}
                                />
                            </div>
                            <div className="confidence-ring-label">Confidence Score</div>
                        </div>
                    </div>

                    {/* Incident Details */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title">Incident Details</div>
                        <div className="info-row">
                            <span className="info-row-label">Alert ID</span>
                            <span className="info-row-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                                {incident.alertId.slice(0, 8)}...
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-row-label">Endpoint</span>
                            <span className="info-row-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-accent)' }}>
                                {incident.endpoint}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-row-label">Category</span>
                            <CategoryBadge category={analysis.category} />
                        </div>
                        <div className="info-row">
                            <span className="info-row-label">Severity</span>
                            <SeverityBadge severity={analysis.severity} />
                        </div>
                        <div className="info-row">
                            <span className="info-row-label">Detected</span>
                            <span className="info-row-value" style={{ fontSize: '0.78rem' }}>
                                {formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-row-label">Timestamp</span>
                            <span className="info-row-value" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {format(new Date(incident.timestamp), 'MMM d, HH:mm:ss')}
                            </span>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title">Quick Links</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <a
                                href="http://localhost:3000/grafana"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                            >
                                📊 Grafana Dashboard
                            </a>
                            <a
                                href="http://localhost:9090"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                            >
                                🔥 Prometheus
                            </a>
                            {incident.githubIssueUrl && incident.githubIssueUrl !== 'https://github.com/placeholder/issue/0' && (
                                <a
                                    href={incident.githubIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                >
                                    🐙 GitHub Issue
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
