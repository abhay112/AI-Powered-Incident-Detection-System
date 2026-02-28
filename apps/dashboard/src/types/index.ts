export interface AIAnalysis {
    rootCause: string;
    suggestedFix: string;
    preventionStrategy: string;
    category: 'Network' | 'Code regression' | 'Validation error' | 'Infrastructure';
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    confidence: number;
}

export interface Incident {
    _id: string;
    alertId: string;
    endpoint: string;
    timestamp: string;
    logs: string;
    commitDiff: string;
    payload: Record<string, unknown>;
    aiAnalysis: AIAnalysis;
    githubIssueUrl: string;
    status: 'OPEN' | 'RESOLVED';
    createdAt: string;
    updatedAt: string;
}

export interface IncidentListResponse {
    success: boolean;
    count: number;
    data: Incident[];
}

export interface IncidentDetailResponse {
    success: boolean;
    data: Incident;
}
