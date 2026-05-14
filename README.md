# Recruiting Automation System

## Overview

**Stack:** MongoDB, Express.js, React, Node.js, Redis, BullMQ, OpenAI, Google Gemini  
**Architecture:** Monorepo (`pnpm` workspaces + Turborepo)  
**Type Safety:** End-to-end TypeScript — shared types from API to frontend

---

## What's Built

An AI-powered recruiting automation system with:

- Background job processing (non-blocking AI and scraping tasks)
- LLM-powered candidate scoring (OpenAI GPT-4o-mini)
- Personalized outreach generation (Google Gemini)
- Intent classification for candidate responses
- Real-time UI updates via Server-Sent Events
- JWT-secured admin dashboard with Bull Board queue monitoring
- Email notifications on task completion/failure (Nodemailer)

---

## Setup and Run

### Prerequisites

- Docker & Docker Compose
- Node.js v18+
- pnpm

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in your keys:

```env
# Server
NODE_ENV=development
PORT=3001
JWT_SECRET=your_long_random_secret

# Database
MONGODB_URI=mongodb://localhost:27017/recruiting

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Services
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Sourcing Provider: 'serper' | 'puppeteer' | 'mock'
SOURCING_PROVIDER=mock
SERPER_API_KEY=your_serper_api_key

# Frontend
FRONTEND_URL=http://localhost:5173

# Email Notifications (optional — works with Gmail, SendGrid, AWS SES, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your_app_password
ALERT_EMAIL_TO=alerts@yourcompany.com
```

### 3. Start with Docker Compose

```bash
docker-compose up
```

Starts: MongoDB, Redis, API server, Worker process (separate container), React frontend.

| Service      | URL                                   |
| ------------ | ------------------------------------- |
| Frontend     | http://localhost:5173                 |
| API          | http://localhost:3001                 |
| Swagger Docs | http://localhost:3001/api/docs        |
| Bull Board   | http://localhost:3001/admin/queues \* |
| Redis UI     | http://localhost:8081                 |

> \* **Admin access only** — requires a valid JWT with `role: "admin"`.

### 4. Start Locally (without Docker)

```bash
# Terminal 1 — API server
pnpm --filter @recruiting/api dev

# Terminal 2 — Background workers (separate process)
pnpm --filter @recruiting/api dev:worker

# Terminal 3 — Frontend
pnpm --filter @recruiting/web dev
```

---

## API Reference

### Authentication

```
POST /api/auth/register   Register a new user
POST /api/auth/login      Login and receive JWT
GET  /api/auth/me         Get current user (protected)
```

All other routes require `Authorization: Bearer <token>` header.

---

### 1. Job Management

```
POST /api/jobs            Create a new job
GET  /api/jobs            List all jobs
GET  /api/jobs/:id        Get job details
```

**Create Job — Request Body:**

```json
{
    "title": "Senior Node.js Developer",
    "description": "We are looking for...",
    "requirements": ["5+ years Node.js", "MongoDB", "Redis"],
    "location": "Remote",
    "type": "full-time",
    "sourcingQueries": ["Node.js Developer Remote", "Backend Engineer Node.js"]
}
```

---

### 2. Candidate Sourcing

```
POST /api/jobs/:jobId/sourcing-tasks    Trigger candidate sourcing (background job)
GET  /api/jobs/:jobId/candidates        List candidates for a job
GET  /api/tasks/:taskId                 Check task status
```

**Request Body:**

```json
{
    "query": "Node.js Developer Remote",
    "limit": 10
}
```

**Response (background job initiated):**

```json
{
    "success": true,
    "data": {
        "taskId": "507f1f77bcf86cd799439011",
        "status": "queued"
    }
}
```

**Sourcing Providers (switch via `SOURCING_PROVIDER` env var):**

| Provider    | Description                                          |
| ----------- | ---------------------------------------------------- |
| `serper`    | Google Search API — fast, accurate LinkedIn sourcing |
| `puppeteer` | Headless Chromium — Google Dork scraping fallback    |
| `mock`      | Local stub — for development without API keys        |

---

### 3. AI-Powered Candidate Scoring

```
POST /api/candidates/:id/scores    Score a candidate against job requirements
```

**Response:**

```json
{
    "success": true,
    "data": {
        "score": {
            "value": 87,
            "reasoning": "Strong Node.js background with 6 years of backend experience...",
            "strengths": ["Expert-level MongoDB", "Redis experience", "Remote-friendly"],
            "weaknesses": ["No AWS experience mentioned", "No TypeScript listed"]
        },
        "fromCache": false
    }
}
```

---

### 4. Automated Candidate Engagement

```
POST /api/candidates/:id/outreach    Generate and queue personalized outreach
```

**Request Body:**

```json
{
    "jobId": "507f1f77bcf86cd799439011"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "taskId": "507f1f77bcf86cd799439014",
        "status": "queued"
    }
}
```

---

### 5. Candidate Response Handling

```
POST /api/candidates/:id/responses    Simulate and classify a candidate reply
```

**Request Body:**

```json
{
    "message": "Yes, I'm very interested! Let's connect."
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "intent": "interested",
        "confidence": 0.96,
        "schedulingLink": "https://calendly.com/recruiter/30min"
    }
}
```

---

### 6. Real-Time Event Stream

```
GET /api/stream/events    SSE endpoint — push task updates to the frontend
```

Frontend connects automatically via `EventSource`. On any task state change (queued → processing → completed/failed), the React dashboard invalidates its queries and re-fetches — no manual polling.

---

## Architecture and Design Decisions

### Monorepo

Chose a pnpm workspaces + Turborepo monorepo over separate repos to:

- Share TypeScript types between API and frontend without a build step
- Run `typecheck`, `lint`, and `build` across both apps with a single command
- Keep Docker orchestration simple under one `docker-compose.yml`

### Async Processing (BullMQ + Redis)

Heavy operations (AI calls, web scraping) are never blocking. The API responds immediately with a `taskId`. Workers run in a **separate process** (and separate Docker container), consuming jobs from Redis queues.

```
POST /sourcing-tasks
        │
        ▼
    [API Server]  ──→  enqueue job  ──→  [Redis Queue]
        │                                      │
   respond 202                          [Worker Process]
                                               │
                                        scrape / score / generate
                                               │
                                        update MongoDB + broadcast SSE
```

### Provider Pattern (Sourcing)

The sourcing engine uses a factory pattern — swap providers by changing one env var:

```
SOURCING_PROVIDER=serper     → SerperProvider (Google Search API)
SOURCING_PROVIDER=puppeteer  → PuppeteerProvider (headless Chromium)
SOURCING_PROVIDER=mock       → MockProvider (testing, no API key needed)
```

### JWT Authentication

- Stateless JWT tokens — no session storage
- `protect` middleware validates the token on every protected route
- `adminGuard` middleware additionally checks `role === "admin"` for sensitive routes (Bull Board)
- Frontend uses Axios request interceptors to attach the token automatically

---

## Caching Strategy

Redis is used for two distinct caching layers:

**1. AI Scoring Cache (24-hour TTL)**

Cache key: `score:{candidateId}:{jobId}`

Before calling OpenAI, the scoring worker checks Redis. A cache hit skips the API call entirely — reducing latency from ~3s to <10ms and eliminating repeated API costs for the same candidate.

**2. API Response Caching**

Job listings and candidate lists are cached in Redis for 5 minutes. Writes (create/update) invalidate the relevant keys immediately.

---

## Email Notifications

Workers send HTML emails via Nodemailer when:

- ✅ A task completes successfully (green template with result data)
- ❌ A task fails after all retries exhausted (red template with error + attempt count)

Email alerts are **optional** — if `SMTP_HOST` is not configured, the service no-ops silently and workers continue unaffected.

Compatible with: Gmail, Outlook, SendGrid, Mailgun, AWS SES, or any SMTP server.

---

## Repository Structure

```
/
├── apps/
│   ├── api/                   Express API + BullMQ Workers
│   │   ├── src/
│   │   │   ├── config/        DB, Redis, logger, env, AI clients
│   │   │   ├── middleware/    errorHandler, authHandler, adminGuard, requestLogger
│   │   │   ├── modules/       jobs, candidates, tasks, auth, sourcing, stream
│   │   │   ├── queues/        BullMQ queue definitions
│   │   │   ├── services/      sse.service, email.service
│   │   │   ├── workers/       sourcing, scoring, outreach workers
│   │   │   ├── types/         Shared TypeScript interfaces
│   │   │   ├── server.ts      API entrypoint (Express)
│   │   │   └── worker.ts      Worker entrypoint (no HTTP, separate process)
│   │   └── Dockerfile
│   └── web/                   React + Vite Frontend
│       ├── src/
│       │   ├── components/    Layout, QueueStats
│       │   ├── contexts/      AuthContext
│       │   ├── pages/         Jobs, Candidates, Details, Login
│       │   ├── services/      api.ts (Axios + JWT interceptor)
│       │   └── types/         Frontend TypeScript interfaces
│       └── Dockerfile
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Submission Checklist

- [x] Code runs without errors (`tsc --noEmit` passes on both apps)
- [x] README explains setup and architecture
- [x] Background worker runs as a separate process (`npm run dev:worker`)
- [x] Complete flow works: Create job → Source candidates → Score → Outreach → Classify response
- [x] JWT authentication secures all API routes
- [x] Bull Board queue dashboard (admin-only)
- [x] Real-time SSE replaces polling on the frontend
- [x] Email notifications on task completion/failure
- [x] Redis caching for AI scoring (24h TTL)
