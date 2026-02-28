# ⚡ AI-Powered Incident Detection & Auto GitHub Issue System

> A production-style SRE automation platform that simulates API failures, uses Prometheus + Grafana for observability, leverages an LLM for root cause analysis, and automatically creates GitHub issues — all with a React dashboard.

---

## 🏗 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INCIDENT PIPELINE                            │
│                                                                      │
│  ┌──────────────┐    scrape     ┌─────────────┐                      │
│  │  api-service │ ──────────── ▶│  Prometheus  │                      │
│  │  (port 3000) │  /metrics     │  (port 9090) │                      │
│  │              │               └──────┬───────┘                      │
│  │  GET /health │                      │ evaluate                     │
│  │  POST /process│                     │ alert rules                  │
│  │  GET /metrics │               ┌──────▼───────┐                     │
│  │              │               │    Grafana    │                     │
│  │  Writes logs │               │  (port 3001)  │                     │
│  │  to /logs/   │               │               │                     │
│  └──────┬───────┘               │  Alert Rule:  │                     │
│         │                       │  health < 1   │                     │
│         │ shared                │  for 60s      │                     │
│         │ volume                └──────┬────────┘                     │
│         │                             │ POST webhook                  │
│         ▼                             ▼                               │
│  ┌──────────────────────────────────────────────┐                     │
│  │           incident-service (port 4000)        │                     │
│  │                                               │                     │
│  │  1. Read /logs/error.log (last 50 lines)      │                     │
│  │  2. git log -p -1 (commit diff)               │                     │
│  │  3. Extract payload + stack trace             │ ──── OpenAI API ──▶ │
│  │  4. Send to LLM → structured JSON             │ ◀────────────────── │
│  │  5. POST GitHub issue                ─────────┼──── GitHub API ──▶  │
│  │  6. Save to MongoDB                           │                     │
│  └──────────────┬────────────────────────────────┘                     │
│                 │                                                      │
│                 ▼                                                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                  │
│  │       MongoDB         │   │  React Dashboard     │                  │
│  │   (port 27017)        │   │    (port 8080)        │                  │
│  │                       │   │                       │                  │
│  │  Collection: incidents│   │  - Incident List      │                  │
│  │  - alertId            │   │  - Incident Detail    │                  │
│  │  - aiAnalysis         │   │  - Re-analyze         │                  │
│  │  - githubIssueUrl     │   │  - Mark Resolved      │                  │
│  │  - status             │   │  - Failure Simulator  │                  │
│  └───────────────────────┘   └───────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 End-to-End Flow Explanation

### 1. Failure Simulation
The `api-service` exposes `/health` and `/process` endpoints that randomly fail:
- `/health` → 30% chance of returning 500 (sets `api_health_status` gauge to 0)
- `/process` → 40% chance of throwing realistic errors (null pointer, DB connection, timeout, validation)

All errors are logged in structured JSON format to `/logs/error.log`.

### 2. Observability (Prometheus)
Prometheus scrapes `/metrics` every 10 seconds, collecting:
- `http_requests_total` — request counts by method/route/status
- `http_errors_total` — error counts
- `api_health_status` — health gauge (1=ok, 0=unhealthy)

### 3. Alerting (Grafana)
Grafana evaluates the alert rule every 60 seconds. If `avg_over_time(api_health_status[1m]) < 1`, it fires a webhook to:
```
POST http://incident-service:4000/webhook/alert
```

### 4. AI Analysis Pipeline (`incident-service`)
Upon receiving the webhook:
1. **Context Collection**: Reads last 50 lines from `/logs/error.log`, extracts payload + stack trace, runs `git log -p -1`
2. **LLM Analysis**: Sends structured prompt to OpenAI GPT-4o, receives JSON with: `rootCause`, `suggestedFix`, `preventionStrategy`, `category`, `severity`, `confidence`
3. **GitHub Issue**: POSTs a rich markdown issue to GitHub with all analysis details
4. **Database**: Saves complete incident record to MongoDB

### 5. Dashboard
React dashboard polls the incident API every 10s and displays:
- Stats: total, open, critical, avg AI confidence
- Incident table with sortable severity badges, confidence bars, GitHub links
- Detail view: root cause, fix, prevention, collapsible logs & commit diffs, re-analyze & resolve buttons

---

## 🚀 How to Run

### Prerequisites
- Docker + Docker Compose installed
- (Optional) OpenAI API key for real AI analysis
- (Optional) GitHub Personal Access Token for auto issue creation

### Setup

```bash
# 1. Navigate to project
cd ai-incident-system

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env with your OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

# 3. Launch everything
docker-compose up --build

# 4. Open the dashboard
open http://localhost:8080

# Other services:
# Grafana:    http://localhost:3001  (admin/admin)
# Prometheus: http://localhost:9090
# API:        http://localhost:3000
# Incidents:  http://localhost:4000/incidents
```

> **Note**: If you don't add API keys, the system will use a mock AI analyzer and skip GitHub issues, but everything else works end-to-end.

### Triggering an Incident Manually
You can trigger failures directly from the dashboard using the **Failure Simulator** button, or via curl:
```bash
# Trigger process failures
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/process \
    -H "Content-Type: application/json" \
    -d '{"userId": 123, "amount": -50, "action": "payment"}' > /dev/null
done

# Or directly trigger the incident webhook (bypasses Prometheus/Grafana wait)
curl -X POST http://localhost:4000/webhook/alert \
  -H "Content-Type: application/json" \
  -d '{"status": "firing", "alerts": [{"status": "firing", "labels": {"alertname": "APIHealthFailure"}}]}'
```

---

## 📦 Tech Stack

| Service | Technologies |
|---|---|
| API Service | Node.js, Express, TypeScript, prom-client |
| Incident Service | Node.js, Express, TypeScript, Mongoose, OpenAI SDK, Axios |
| Dashboard | React 18, TypeScript, Vite, React Router, Axios, date-fns |
| Monitoring | Prometheus, Grafana (pre-provisioned alerts + dashboards) |
| Database | MongoDB 7 |
| Infrastructure | Docker, Docker Compose, Nginx |

---

## 🎯 Interview Talking Points

### Observability Design
- **Why Prometheus scrapes instead of push**: Pull model gives Prometheus control over collection, natural service discovery, and built-in failure detection (target goes down = Prometheus knows)
- **Gauge vs Counter**: `api_health_status` is a gauge (can go up and down), while request counts are counters (monotonically increasing)

### AI Integration Pattern
- **Structured output enforcement**: Used `response_format: { type: 'json_object' }` with OpenAI + Zod-like validation to guarantee parseable responses
- **Graceful degradation**: Mock analyzer activates if no API key — system remains functional without OpenAI

### Reliability Patterns Used
- **Async webhook processing**: Respond 200 immediately, process in `setImmediate()` so Grafana doesn't retry
- **MongoDB retry logic**: 5-attempt exponential retry on startup prevents race conditions with Docker
- **Shared log volume**: Docker named volume bridges api-service (writer) and incident-service (reader) without coupling them

### Architecture Decisions
- **No queue/Redis**: For this scale, direct processing works with `setImmediate()`. Queues add operational complexity without proportional benefit at low volume
- **Monorepo**: Shared tooling, easy refactoring, single `docker-compose up` deployment
- **Pre-provisioned Grafana**: All alerts, dashboards, and contact points are in YAML — environment is fully reproducible with zero manual setup

---

## 📁 Project Structure

```
ai-incident-system/
├── apps/
│   ├── api-service/          # Unstable API with Prometheus metrics
│   │   └── src/
│   │       ├── routes/       # /health, /process
│   │       ├── metrics.ts    # prom-client counters/gauges
│   │       └── logger.ts     # JSON structured logger → /logs/error.log
│   ├── incident-service/     # Alert processor + AI + GitHub
│   │   └── src/
│   │       ├── routes/       # /webhook/alert, /incidents CRUD
│   │       ├── models/       # Mongoose Incident schema
│   │       └── services/     # contextCollector, aiAnalyzer, githubService
│   └── dashboard/            # React + TypeScript + Vite
│       └── src/
│           ├── pages/        # IncidentList, IncidentDetail
│           ├── components/   # Navbar, IncidentTable, Collapsible, Toast
│           └── api/          # Axios client
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/provisioning/
│       ├── datasources/      # Auto-connect to Prometheus
│       ├── dashboards/       # Pre-built API dashboard
│       └── alerting/         # Alert rules + webhook contact point
├── docker-compose.yml
├── .env.example
└── README.md
```
# AI-Powered-Incident-Detection-System
# AI-Powered-Incident-Detection-System
