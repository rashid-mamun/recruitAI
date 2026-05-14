# Recruit AI — Backend API

A production-grade AI-powered recruiting automation backend built with Node.js, TypeScript, MongoDB, Redis, and BullMQ. Features real-time SSE streaming, multi-tier AI fallback, and fault-tolerant candidate sourcing.

---

## Architecture Overview

The server and worker run as **separate processes** — the HTTP server handles incoming requests while workers independently process background AI jobs.

```
┌────┐
│                     REST API (Express)                      │
│   Auth │ Jobs │ Candidates │ Tasks │ Sourcing │ Stream      │
└────────┬────┘
                      │ enqueue
┌────────▼────┐
│                  BullMQ Queues (Redis)                      │
│       sourcing-queue │ scoring-queue │ outreach-queue        │
└────────┬────┘
                      │ process
┌────────▼────┐
│                    Worker Process                            │
│   SourcingWorker │ ScoringWorker │ OutreachWorker           │
│                                                              │
│   Sourcing:  Serper → DuckDuckGo → Mock                     │
│   Scoring:   Gemini → Groq → Rule-based                     │
│   Outreach:  Gemini → Groq → Template                       │
│   Classify:  Gemini → Groq → Keyword                        │
└────────┬────┘
                      │ Redis Pub/Sub
┌────────▼────┐
│          SSE Service → Client (Browser / Postman)           │
│         Real-time task progress streaming                    │
└────┘
```

---

## Tech Stack

| Layer                  | Technology                               |
| ---------------------- | ---------------------------------------- |
| Runtime                | Node.js 20 + TypeScript                  |
| Framework              | Express.js                               |
| Database               | MongoDB (Mongoose ODM)                   |
| Queue / Cache          | Redis + BullMQ                           |
| Queue Dashboard        | BullBoard (`/admin/queues`)              |
| Real-time              | Server-Sent Events (SSE) + Redis Pub/Sub |
| AI — Primary           | Google Gemini `gemini-2.5-flash`         |
| AI — Fallback          | Groq `llama-3.3-70b-versatile` (free)    |
| AI — Last resort       | Rule-based / Template / Keyword          |
| Sourcing — Primary     | Serper (Google search API)               |
| Sourcing — Fallback    | DuckDuckGo (free, no key)                |
| Sourcing — Last resort | Mock provider (synthetic data)           |
| Auth                   | JWT + bcrypt                             |
| Validation             | Zod                                      |
| API Docs               | Swagger UI (`/api/docs`)                 |
| Logging                | Winston (structured JSON)                |
| Testing                | Vitest                                   |
| Container              | Docker + Docker Compose                  |

---

## Project Structure

```
apps/api/
├── src/
│   ├── config/
│   │   ├── ai.ts              # Gemini + OpenAI client init
│   │   ├── db.ts              # MongoDB connection
│   │   ├── env.ts             # Zod-validated env schema
│   │   ├── logger.ts          # Winston structured logger
│   │   ├── redis.ts           # Redis connection + cache helpers
│   │   └── swagger.ts         # Swagger/OpenAPI spec
│   │
│   ├── middleware/
│   │   ├── authHandler.ts     # JWT protect() middleware
│   │   ├── adminGuard.ts      # Admin-only guard
│   │   ├── errorHandler.ts    # Global error handler + custom errors
│   │   └── requestLogger.ts   # HTTP request logging
│   │
│   ├── modules/
│   │   ├── auth/              # Register, Login, Me
│   │   ├── candidates/        # CRUD + AI score/outreach/classify
│   │   ├── jobs/              # Jobs CRUD
│   │   ├── tasks/             # Task status + SSE stream
│   │   ├── health/            # Health + readiness checks
│   │   ├── sourcing/          # Sourcing task enqueue
│   │   │   └── providers/
│   │   │       ├── serper.provider.ts       # Paid — Serper (Google search)
│   │   │       ├── duckduckgo.provider.ts   # Free — DuckDuckGo scrape
│   │   │       ├── puppeteer.provider.ts    # Local browser scraping
│   │   │       ├── mock.provider.ts         # Synthetic data (dev/test)
│   │   │       └── provider.factory.ts      # Selects provider via env
│   │   └── stream/            # Generic SSE endpoint (legacy compat)
│   │
│   ├── queues/
│   │   └── index.ts           # BullMQ queue definitions + BullBoard
│   │
│   ├── services/
│   │   ├── ai/
│   │   │   ├── ai.factory.ts              # Returns primary AI provider
│   │   │   ├── ai.interface.ts            # IAiProvider interface
│   │   │   └── providers/
│   │   │       ├── gemini.provider.ts
│   │   │       ├── openai.provider.ts
│   │   │       └── groq.provider.ts       # Free fallback
│   │   ├── email.service.ts   # SMTP email alerts
│   │   ├── pubsub.service.ts  # Redis Pub/Sub publisher
│   │   └── sse.service.ts     # SSE client registry + broadcaster
│   │
│   ├── utils/
│   │   └── smartRetry.ts      # AI retry logic (skips on 429/401/403)
│   │
│   ├── workers/
│   │   ├── sourcing.worker.ts  # LinkedIn candidate sourcing
│   │   ├── scoring.worker.ts   # AI candidate scoring
│   │   └── outreach.worker.ts  # AI outreach message generation
│   │
│   ├── types/index.ts          # Shared TypeScript types
│   ├── app.ts                  # Express app factory
│   ├── server.ts               # HTTP server entry point
│   └── worker.ts               # Worker process entry point
│
├── test/
├── .env
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### Installation

```bash
cd apps/api
npm install
```

### Running in Development

The server and worker must run as separate processes. Open two terminals:

```bash
# Terminal 1 — API Server
npm run dev
# Starts at http://localhost:5000

# Terminal 2 — Background Workers
npm run dev:worker
# Starts SourcingWorker, ScoringWorker, OutreachWorker
```

### Running in Production

```bash
npm run build          # Compile TypeScript
npm run start          # Start API server
npm run start:worker   # Start worker process
```

---

## Environment Variables

Copy the template below into a `.env` file and fill in your values.

```env
# Server
NODE_ENV=development
PORT=5000
JWT_SECRET=your_strong_secret_here

# Database
MONGODB_URI=mongodb://localhost:27017/recruiting

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=optional

# AI Providers
ACTIVE_AI_PROVIDER=gemini        # 'gemini' | 'openai'
GEMINI_API_KEY=AIza...           # https://aistudio.google.com
OPENAI_API_KEY=sk-proj-...       # https://platform.openai.com
GROQ_API_KEY=gsk_...             # https://console.groq.com (free, no credit card)

# Sourcing
SOURCING_PROVIDER=serper         # 'serper' | 'duckduckgo' | 'puppeteer' | 'mock'
SERPER_API_KEY=...               # https://serper.dev (2,500 free credits)

# Frontend
FRONTEND_URL=http://localhost:5173

# Email Alerts (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
ALERT_EMAIL_TO=alerts@yourcompany.com
```

### Required Keys at a Glance

| Key              | Required    | Cost                  | Source                                             |
| ---------------- | ----------- | --------------------- | -------------------------------------------------- |
| `GEMINI_API_KEY` | Recommended | Free tier             | [aistudio.google.com](https://aistudio.google.com) |
| `GROQ_API_KEY`   | Recommended | Free (14,400 req/day) | [console.groq.com](https://console.groq.com)       |
| `SERPER_API_KEY` | Optional    | 2,500 free credits    | [serper.dev](https://serper.dev)                   |
| `OPENAI_API_KEY` | Optional    | Paid                  | [platform.openai.com](https://platform.openai.com) |

> **No keys?** The backend still works fully via rule-based scoring, template outreach, keyword classification, and mock sourcing.

---

## AI Provider System

### Provider Chain

Every AI operation automatically cascades through three tiers:

```
1. Primary  →  Gemini (gemini-2.5-flash) or OpenAI (gpt-4o-mini)
2. Fallback →  Groq llama-3.3-70b (free, 14,400 req/day)
3. Safety   →  Rule-based / Template / Keyword (no API, always works)
```

### Smart Retry Behaviour

| Error                    | Behaviour                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `429` Rate limit / quota | Abort retries immediately, advance to next provider         |
| `401 / 403` Auth failure | Abort retries immediately, advance to next provider         |
| `5xx` Server error       | Retry up to 3× with exponential backoff (1.5 s → 3 s → 6 s) |

### Task Coverage

| Task            | Primary                                             | Groq Fallback         | Last Resort                                    |
| --------------- | --------------------------------------------------- | --------------------- | ---------------------------------------------- |
| Scoring         | JSON prompt → 0–100 score with strengths/weaknesses | Same prompt via Llama | Skill match + title overlap + experience years |
| Outreach        | Personalized LinkedIn message                       | Same prompt via Llama | Template with candidate data                   |
| Classify intent | JSON intent classification                          | Same prompt via Llama | Keyword matching                               |

### Selecting a Primary Provider

```env
ACTIVE_AI_PROVIDER=gemini   # default
ACTIVE_AI_PROVIDER=openai
```

---

## Sourcing Provider System

### Provider Chain

```
1. Serper      — LinkedIn search via Google (paid, 3 retries)
2. DuckDuckGo  — Free HTML scrape, no API key needed (2 retries)
3. Mock        — Synthetic profiles, always succeeds
```

On startup the worker logs the active chain:

```
✅ SourcingWorker started {
  primaryProvider: "serper",
  fallbackChain: "serper → duckduckgo → mock"
}
```

### Provider Comparison

| Provider     | Key Required | Notes                                           |
| ------------ | ------------ | ----------------------------------------------- |
| `serper`     | Yes          | Best quality — real Google search results       |
| `duckduckgo` | No           | Free HTML scraping — may be rate-limited        |
| `puppeteer`  | No           | Local browser scraping — slower, needs Chromium |
| `mock`       | No           | Synthetic data — dev/test use only              |

---

## API Reference

**Base URL:** `http://localhost:5000`  
**Auth:** Protected routes require `Authorization: Bearer <token>`  
**Interactive Docs:** `http://localhost:5000/api/docs` (Swagger UI)  
**Queue Dashboard:** `http://localhost:5000/admin/queues` (admin only)

---

### Health

| Method | Endpoint        | Auth | Description                       |
| ------ | --------------- | ---- | --------------------------------- |
| `GET`  | `/health`       | No   | Liveness probe                    |
| `GET`  | `/health/ready` | No   | Readiness probe (MongoDB + Redis) |

```bash
curl http://localhost:5000/health
# {"status":"ok","uptime":3600}

curl http://localhost:5000/health/ready
# {"status":"ready","mongodb":"connected","redis":"connected"}
```

---

### Auth

| Method | Endpoint             | Auth | Description        |
| ------ | -------------------- | ---- | ------------------ |
| `POST` | `/api/auth/register` | No   | Create account     |
| `POST` | `/api/auth/login`    | No   | Login, receive JWT |
| `GET`  | `/api/auth/me`       | Yes  | Get current user   |

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"StrongPass!1"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"StrongPass!1"}'
# → { "success": true, "data": { "token": "eyJhbGci..." } }
```

---

### Jobs

| Method   | Endpoint        | Auth | Description           |
| -------- | --------------- | ---- | --------------------- |
| `POST`   | `/api/jobs`     | Yes  | Create a job          |
| `GET`    | `/api/jobs`     | Yes  | List jobs (paginated) |
| `GET`    | `/api/jobs/:id` | Yes  | Get job by ID         |
| `PATCH`  | `/api/jobs/:id` | Yes  | Update job            |
| `DELETE` | `/api/jobs/:id` | Yes  | Soft-delete job       |

```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Node.js Engineer",
    "description": "Build scalable APIs for our AI recruiting platform.",
    "requirements": ["5+ years Node.js", "TypeScript", "MongoDB", "Redis"],
    "location": "Remote",
    "type": "full-time",
    "status": "active"
  }'
```

---

### Candidates

| Method | Endpoint                      | Auth | Description                           |
| ------ | ----------------------------- | ---- | ------------------------------------- |
| `GET`  | `/api/jobs/:jobId/candidates` | Yes  | List candidates for a job (paginated) |
| `GET`  | `/api/:id`                    | Yes  | Get candidate by ID                   |
| `POST` | `/api/:id/scores`             | Yes  | Trigger AI scoring (async)            |
| `POST` | `/api/:id/outreach`           | Yes  | Send AI outreach message (async)      |
| `POST` | `/api/:id/responses`          | Yes  | Classify candidate reply (sync)       |
| `GET`  | `/api/:id/messages`           | Yes  | List outreach messages                |

**Supported query params for listing:**

```
?page=1&limit=10&sort=-score.value&status=sourced
```

**Candidate status flow:**

```
sourced → scored → contacted → scheduling | rejected
```

**Score a Candidate:**

```bash
# Enqueues a scoring job and returns a taskId immediately
curl -X POST http://localhost:5000/api/$CAND_ID/scores \
  -H "Authorization: Bearer $TOKEN"

# Force re-score (bypasses cache)
curl -X POST "http://localhost:5000/api/$CAND_ID/scores?refresh=true" \
  -H "Authorization: Bearer $TOKEN"

# → { "success": true, "data": { "taskId": "...", "status": "queued" } }
```

**Send Outreach:**

```bash
curl -X POST http://localhost:5000/api/$CAND_ID/outreach \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "JOB_ID_HERE"}'
```

**Classify a Candidate Reply:**

```bash
curl -X POST http://localhost:5000/api/$CAND_ID/responses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Yes, I am very interested! When can we schedule a call?"}'

# → {
#     "intent": "interested",
#     "confidence": 1.0,
#     "reason": "Candidate explicitly expresses interest and asks to schedule.",
#     "candidateStatus": "scheduling",
#     "schedulingLink": "https://cal.recruitai.app/schedule/..."
#   }
```

**Intent values:** `interested` | `not_interested` | `maybe`

---

### Sourcing

| Method | Endpoint                          | Auth | Description                    |
| ------ | --------------------------------- | ---- | ------------------------------ |
| `POST` | `/api/jobs/:jobId/sourcing-tasks` | Yes  | Start a candidate sourcing job |

```bash
curl -X POST http://localhost:5000/api/jobs/$JOB_ID/sourcing-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "senior nodejs typescript engineer remote", "limit": 10}'

# → { "success": true, "data": { "taskId": "...", "status": "queued" } }
```

Sourcing completion automatically enqueues AI scoring jobs for all discovered candidates.

---

### Tasks

| Method | Endpoint                    | Auth | Description          |
| ------ | --------------------------- | ---- | -------------------- |
| `GET`  | `/api/tasks/:taskId`        | Yes  | Poll task status     |
| `GET`  | `/api/tasks/:taskId/stream` | No   | Real-time SSE stream |

**Poll Task Status:**

```bash
curl http://localhost:5000/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN"

# → {
#     "type": "scoring",
#     "status": "completed",     ← queued | processing | completed | failed
#     "progress": 100,
#     "result": { "score": { "value": 85, "source": "ai" } },
#     "error": null
#   }
```

---

### Queue Stats

| Method | Endpoint           | Auth | Description          |
| ------ | ------------------ | ---- | -------------------- |
| `GET`  | `/api/queue-stats` | No   | Job counts per queue |

```bash
curl http://localhost:5000/api/queue-stats

# → [
#     { "name": "sourcing", "waiting": 0, "active": 1, "completed": 12, "failed": 0 },
#     { "name": "scoring",  "waiting": 3, "active": 2, "completed": 47, "failed": 0 },
#     { "name": "outreach", "waiting": 0, "active": 0, "completed": 8,  "failed": 0 }
#   ]
```

---

## Background Workers

Three workers run in `worker.ts` as a separate process.

### SourcingWorker (concurrency: 3)

- Consumes jobs from the `sourcing` queue
- Searches LinkedIn profiles via the provider chain (Serper → DuckDuckGo → Mock)
- Upserts candidates to MongoDB, deduplicating by `linkedinUrl + jobId`
- Automatically enqueues scoring jobs for all newly added candidates

### ScoringWorker (concurrency: 5)

- Consumes jobs from the `scoring` queue
- Checks Redis cache first — skips AI call if a fresh score already exists
- Calls the AI chain: Gemini → Groq → rule-based
- Persists score to the candidate document and Redis cache (TTL: 24 h for AI scores, 1 h for fallback)

### OutreachWorker (concurrency: 2)

- Consumes jobs from the `outreach` queue
- Generates a personalized LinkedIn message via the AI chain: Gemini → Groq → template
- Saves the message to the `Message` collection
- Updates candidate status to `contacted`

---

## Real-Time Streaming (SSE)

Track background job progress in real time using Server-Sent Events.

```bash
# Streams live updates until the task completes
curl -N http://localhost:5000/api/tasks/$TASK_ID/stream

# event: task_updated
# data: {"status":"processing","progress":40,...}

# event: task_updated
# data: {"status":"completed","progress":100,"result":{...}}
```

**Browser / JavaScript:**

```javascript
const es = new EventSource(`http://localhost:5000/api/tasks/${taskId}/stream`);

es.addEventListener('task_updated', e => {
    const task = JSON.parse(e.data);
    console.log(`Progress: ${task.progress}%  Status: ${task.status}`);
    if (task.status === 'completed' || task.status === 'failed') {
        es.close();
    }
});
```

**How it works:**

1. Worker updates task progress → publishes event to Redis channel `task-events-channel`
2. API server subscribes to that channel → pushes events to all SSE clients subscribed to that `taskId`
3. A heartbeat ping every 25 s keeps the connection alive through proxies and load balancers

---

## Fallback Chains

The system **never returns a 500** due to an external API failure. Every AI and sourcing call has at least three layers.

### Sourcing

```
Serper (paid, 3 retries)
  ↓ exhausted
DuckDuckGo (free scrape, no key, 2 retries)
  ↓ exhausted
Mock Provider (synthetic profiles, always succeeds)
```

### AI (Scoring, Outreach, Classify)

```
Primary — Gemini or OpenAI (3 retries, skips on 429/401/403)
  ↓ fails
Groq — llama-3.3-70b (free, 14,400 req/day, 3 retries)
  ↓ fails
Rule-based / Template / Keyword (local, no API, always works)
```

### Quality Comparison

| Scenario      | Scoring                                        | Outreach                                                      | Classify                              |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| AI available  | 0–100 score with strengths and weaknesses      | Personalized message referencing candidate's exact background | Semantic intent with confidence score |
| Groq fallback | Same analysis quality via Llama                | Same personalization quality via Llama                        | Same semantic quality via Llama       |
| No AI         | Skill match + title overlap + experience years | Template filled with candidate data                           | Keyword: yes / no / not looking       |

---

## Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch
```

All external dependencies — MongoDB, Redis, BullMQ, and AI providers — are mocked in tests.

```
test/
├── auth.test.ts
├── jobs.test.ts
├── candidates.test.ts
├── tasks.test.ts
├── sourcing-and-queue-stats.test.ts
├── health.test.ts
├── sse-streaming.test.ts
└── scoring-worker.test.ts
```

---

## Docker

```bash
# Start everything (MongoDB, Redis, API, Worker)
docker compose up

# Rebuild images and start
docker compose up --build

# Stop and remove containers
docker compose down
```

| Service    | Port    |
| ---------- | ------- |
| API Server | `5000`  |
| MongoDB    | `27017` |
| Redis      | `6379`  |

---

## Monitoring

| URL                                     | Description                  |
| --------------------------------------- | ---------------------------- |
| `http://localhost:5000/health`          | Liveness check               |
| `http://localhost:5000/health/ready`    | Readiness check (DB + Redis) |
| `http://localhost:5000/api/docs`        | Swagger UI                   |
| `http://localhost:5000/api/queue-stats` | Queue job counts             |
| `http://localhost:5000/admin/queues`    | BullBoard (admin only)       |

---

## Response Format

All endpoints return a consistent envelope.

**Success:**

```json
{
    "success": true,
    "data": {},
    "pagination": { "page": 1, "limit": 10, "total": 47, "totalPages": 5 }
}
```

**Error:**

```json
{
    "success": false,
    "error": "Candidate not found",
    "code": "NOT_FOUND"
}
```

**Error codes:** `VALIDATION_ERROR` | `NOT_FOUND` | `UNAUTHORIZED` | `FORBIDDEN` | `INTERNAL_ERROR`

---

## Quick Start (curl)

```bash
BASE=http://localhost:5000

# 1. Register
curl -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","password":"Demo1234!"}'

# 2. Login — capture the token
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo1234!"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 3. Create a job
JOB_ID=$(curl -s -X POST $BASE/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Senior Node.js Engineer",
    "description":"Build AI-powered APIs",
    "requirements":["Node.js","TypeScript","MongoDB"],
    "location":"Remote",
    "type":"full-time",
    "status":"active"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['_id'])")

# 4. Source candidates (Serper → DuckDuckGo → Mock)
TASK_ID=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/sourcing-tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"senior nodejs typescript engineer remote","limit":5}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['taskId'])")

# 5. Stream sourcing progress (SSE)
curl -N $BASE/api/tasks/$TASK_ID/stream

# 6. List discovered candidates
curl "$BASE/api/jobs/$JOB_ID/candidates" -H "Authorization: Bearer $TOKEN"

# 7. Score a candidate (Gemini → Groq → rule-based)
CAND_ID=<candidate_id_from_step_6>
curl -X POST "$BASE/api/$CAND_ID/scores?refresh=true" \
  -H "Authorization: Bearer $TOKEN"

# 8. Send outreach (Gemini → Groq → template)
curl -X POST "$BASE/api/$CAND_ID/outreach" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jobId\":\"$JOB_ID\"}"

# 9. Classify candidate reply (Gemini → Groq → keyword)
curl -X POST "$BASE/api/$CAND_ID/responses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Yes, sounds great! I am interested, lets connect."}'

# 10. Queue stats
curl $BASE/api/queue-stats
```

---

## License

MIT
