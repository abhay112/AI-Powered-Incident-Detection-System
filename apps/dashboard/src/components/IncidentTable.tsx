import { Incident } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Props {
    incidents: Incident[];
}

function SeverityBadge({ severity }: { severity: Incident['aiAnalysis']['severity'] }) {
    const icons: Record<string, string> = {
        Critical: '🔴',
        High: '🟠',
        Medium: '🟡',
        Low: '🟢',
    };
    return (
        <span className={`badge badge-${severity.toLowerCase()}`}>
            {icons[severity]} {severity}
        </span>
    );
}

function StatusBadge({ status }: { status: Incident['status'] }) {
    return (
        <span className={`badge badge-${status.toLowerCase()}`}>
            {status === 'OPEN' ? '●' : '✓'} {status}
        </span>
    );
}

function ConfidenceBar({ value }: { value: number }) {
    return (
        <div className="confidence-bar">
            <div className="confidence-track">
                <div className="confidence-fill" style={{ width: `${value}%` }} />
            </div>
            <span className="confidence-value">{value}%</span>
        </div>
    );
}

export default function IncidentTable({ incidents }: Props) {
    const navigate = useNavigate();

    return (
        <div className="incidents-table-wrapper">
            <table className="incidents-table" role="table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Endpoint</th>
                        <th>Category</th>
                        <th>Confidence</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>GitHub</th>
                    </tr>
                </thead>
                <tbody>
                    {incidents.map((incident) => (
                        <tr
                            key={incident._id}
                            onClick={() => navigate(`/incidents/${incident._id}`)}
                            role="button"
                            tabIndex={0}
                            aria-label={`View incident on ${incident.endpoint}`}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/incidents/${incident._id}`)}
                        >
                            <td>
                                <SeverityBadge severity={incident.aiAnalysis.severity} />
                            </td>
                            <td>
                                <code className="incident-endpoint">{incident.endpoint}</code>
                            </td>
                            <td>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                    {incident.aiAnalysis.category}
                                </span>
                            </td>
                            <td>
                                <ConfidenceBar value={incident.aiAnalysis.confidence} />
                            </td>
                            <td>
                                <StatusBadge status={incident.status} />
                            </td>
                            <td>
                                <span className="incident-time" title={new Date(incident.timestamp).toISOString()}>
                                    {formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}
                                </span>
                            </td>
                            <td>
                                {incident.githubIssueUrl && incident.githubIssueUrl !== 'https://github.com/placeholder/issue/0' ? (
                                    <a
                                        href={incident.githubIssueUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="github-link"
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label="View GitHub issue"
                                    >
                                        🐙 Issue
                                    </a>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
