import OpenAI from 'openai';
import { AIAnalysis } from '../models/Incident';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a senior Site Reliability Engineer and backend architect.

Analyze the production API failure using the following context.

Provide response in STRICT JSON format only. No markdown, no explanation - just valid JSON.`;

function buildUserPrompt(logs: string, commitDiff: string, payload: Record<string, unknown>): string {
    return `Error Logs:
${logs}

Recent Commit Diff:
${commitDiff}

API Payload:
${JSON.stringify(payload, null, 2)}

Tasks:
1. Identify likely root cause
2. Suggest specific code-level fix
3. Suggest long-term prevention strategy
4. Categorize failure type:
   - Network
   - Code regression
   - Validation error
   - Infrastructure
5. Assign severity:
   - Low
   - Medium
   - High
   - Critical
6. Provide confidence score (0-100)

Respond with ONLY this JSON structure:
{
  "rootCause": "string",
  "suggestedFix": "string",
  "preventionStrategy": "string",
  "category": "Network | Code regression | Validation error | Infrastructure",
  "severity": "Low | Medium | High | Critical",
  "confidence": number
}`;
}

function validateAIResponse(data: unknown): AIAnalysis {
    if (typeof data !== 'object' || data === null) {
        throw new Error('AI response is not an object');
    }

    const obj = data as Record<string, unknown>;

    const validCategories = ['Network', 'Code regression', 'Validation error', 'Infrastructure'];
    const validSeverities = ['Low', 'Medium', 'High', 'Critical'];

    if (typeof obj.rootCause !== 'string' || !obj.rootCause) {
        throw new Error('Missing or invalid rootCause');
    }
    if (typeof obj.suggestedFix !== 'string' || !obj.suggestedFix) {
        throw new Error('Missing or invalid suggestedFix');
    }
    if (typeof obj.preventionStrategy !== 'string' || !obj.preventionStrategy) {
        throw new Error('Missing or invalid preventionStrategy');
    }
    if (!validCategories.includes(obj.category as string)) {
        throw new Error(`Invalid category: ${obj.category}`);
    }
    if (!validSeverities.includes(obj.severity as string)) {
        throw new Error(`Invalid severity: ${obj.severity}`);
    }
    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
        throw new Error(`Invalid confidence: ${obj.confidence}`);
    }

    return obj as unknown as AIAnalysis;
}

/**
 * Call OpenAI to analyze the incident and return structured analysis
 */
export async function analyzeIncident(
    logs: string,
    commitDiff: string,
    payload: Record<string, unknown>
): Promise<AIAnalysis> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.warn('⚠️  OpenAI API key not set. Using mock analysis for development.');
        return getMockAnalysis(logs);
    }

    const userPrompt = buildUserPrompt(logs, commitDiff, payload);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return validateAIResponse(parsed);
}

/**
 * Mock analysis for development/testing without a real API key
 */
function getMockAnalysis(logs: string): AIAnalysis {
    const isValidation = logs.includes('Validation');
    const isDatabase = logs.includes('Mongo') || logs.includes('connect ECONNREFUSED');
    const isTimeout = logs.includes('timeout');

    if (isValidation) {
        return {
            rootCause: 'Input validation failure: The API received a malformed or incomplete request payload that failed schema validation.',
            suggestedFix: 'Add comprehensive request validation middleware using Joi or Zod. Validate all required fields before processing.',
            preventionStrategy: 'Implement API contract testing using Pact.io and add input validation at both API gateway and service levels.',
            category: 'Validation error',
            severity: 'Medium',
            confidence: 85,
        };
    }

    if (isDatabase) {
        return {
            rootCause: 'Database connectivity issue: The service failed to establish a connection to MongoDB, likely due to network partitioning or MongoDB being unavailable.',
            suggestedFix: 'Implement connection pooling with retry logic using exponential backoff. Add health checks before processing requests.',
            preventionStrategy: 'Deploy a database replica set for high availability. Implement circuit breaker pattern for database calls.',
            category: 'Infrastructure',
            severity: 'Critical',
            confidence: 92,
        };
    }

    if (isTimeout) {
        return {
            rootCause: 'Network timeout: Downstream service did not respond within the configured timeout threshold, causing cascading failures.',
            suggestedFix: 'Implement Circuit Breaker pattern (e.g., using opossum library). Add configurable timeout per downstream service.',
            preventionStrategy: 'Use async processing for non-critical downstream calls. Set up SLO monitoring and alerting on p99 latency.',
            category: 'Network',
            severity: 'High',
            confidence: 78,
        };
    }

    return {
        rootCause: 'Null pointer dereference: The code attempted to access a property on an undefined or null object.',
        suggestedFix: 'Add null/undefined checks before property access. Use optional chaining (?.) and nullish coalescing (??) operators.',
        preventionStrategy: 'Enable strict TypeScript checks. Add comprehensive unit tests for edge cases. Implement defensive programming patterns.',
        category: 'Code regression',
        severity: 'High',
        confidence: 80,
    };
}
