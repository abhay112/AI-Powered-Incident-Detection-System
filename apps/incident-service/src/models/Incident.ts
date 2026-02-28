import mongoose, { Document, Schema } from 'mongoose';

export interface AIAnalysis {
    rootCause: string;
    suggestedFix: string;
    preventionStrategy: string;
    category: 'Network' | 'Code regression' | 'Validation error' | 'Infrastructure';
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    confidence: number;
}

export interface IIncident extends Document {
    alertId: string;
    endpoint: string;
    timestamp: Date;
    logs: string;
    commitDiff: string;
    payload: Record<string, unknown>;
    aiAnalysis: AIAnalysis;
    githubIssueUrl: string;
    status: 'OPEN' | 'RESOLVED';
    createdAt: Date;
    updatedAt: Date;
}

const AIAnalysisSchema = new Schema<AIAnalysis>({
    rootCause: { type: String, required: true },
    suggestedFix: { type: String, required: true },
    preventionStrategy: { type: String, required: true },
    category: {
        type: String,
        enum: ['Network', 'Code regression', 'Validation error', 'Infrastructure'],
        required: true,
    },
    severity: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        required: true,
    },
    confidence: { type: Number, min: 0, max: 100, required: true },
});

const IncidentSchema = new Schema<IIncident>(
    {
        alertId: { type: String, required: true, unique: true, index: true },
        endpoint: { type: String, required: true },
        timestamp: { type: Date, required: true },
        logs: { type: String, required: true },
        commitDiff: { type: String, default: '' },
        payload: { type: Schema.Types.Mixed, default: {} },
        aiAnalysis: { type: AIAnalysisSchema, required: true },
        githubIssueUrl: { type: String, default: '' },
        status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
    },
    {
        timestamps: true,
    }
);

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
