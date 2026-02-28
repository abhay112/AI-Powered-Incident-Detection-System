import fs from 'fs';
import path from 'path';

const LOG_DIR = '/logs';
const LOG_FILE = path.join(LOG_DIR, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

export interface LogEntry {
    timestamp: string;
    level: 'ERROR' | 'INFO' | 'WARN';
    endpoint: string;
    method: string;
    payload?: unknown;
    error?: string;
    stackTrace?: string;
    requestId?: string;
}

export function writeErrorLog(entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
    console.error(`[${entry.level}] ${entry.timestamp} ${entry.method} ${entry.endpoint} - ${entry.error || 'Unknown error'}`);
}

export function writeInfoLog(entry: Omit<LogEntry, 'level'>): void {
    const logEntry: LogEntry = { ...entry, level: 'INFO' };
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
    console.log(`[INFO] ${entry.timestamp} ${entry.method} ${entry.endpoint}`);
}
