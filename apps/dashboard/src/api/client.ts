/// <reference types="vite/client" />
import axios from 'axios';
import { IncidentListResponse, IncidentDetailResponse, Incident } from '../types';

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const incidentApi = {
    getAll: async (): Promise<IncidentListResponse> => {
        const response = await api.get<IncidentListResponse>('/incidents');
        return response.data;
    },

    getById: async (id: string): Promise<IncidentDetailResponse> => {
        const response = await api.get<IncidentDetailResponse>(`/incidents/${id}`);
        return response.data;
    },

    reanalyze: async (id: string): Promise<IncidentDetailResponse> => {
        const response = await api.post<IncidentDetailResponse>(`/incidents/${id}/reanalyze`);
        return response.data;
    },

    resolve: async (id: string): Promise<{ success: boolean; data: Incident }> => {
        const response = await api.patch<{ success: boolean; data: Incident }>(`/incidents/${id}/resolve`);
        return response.data;
    },
};

export const simulateApi = {
    triggerFailure: async (): Promise<void> => {
        const apiServiceUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_SERVICE_URL || 'http://localhost:3000';
        try {
            await axios.post(`${apiServiceUrl}/process`, {
                simulatedRequest: true,
                userId: Math.floor(Math.random() * 1000),
                amount: Math.random() > 0.5 ? -100 : 500,
                timestamp: new Date().toISOString(),
            });
        } catch {
            // Expected to fail sometimes
        }
    },

    // Directly fires the incident webhook — triggers immediate AI analysis + GitHub issue
    triggerWebhook: async (): Promise<void> => {
        await api.post('/webhook/alert', {
            status: 'firing',
            alerts: [{
                status: 'firing',
                labels: { alertname: 'APIHealthFailure', severity: 'critical' },
                annotations: { summary: 'API health check triggered from dashboard' },
                startsAt: new Date().toISOString(),
            }],
        });
    },

    checkHealth: async (): Promise<{ status: string }> => {
        const apiServiceUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_SERVICE_URL || 'http://localhost:3000';
        try {
            const response = await axios.get<{ status: string }>(`${apiServiceUrl}/health`);
            return response.data;
        } catch {
            return { status: 'unhealthy' };
        }
    },
};
