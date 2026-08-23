# RecruitAI

RecruitAI is a full-stack recruiting operations platform for sourcing candidates, AI-assisted evaluation, outreach, interviews, hiring decisions, reporting, and team collaboration. It is a production-oriented TypeScript monorepo that remains practical to run and deploy on free-tier infrastructure.

## Highlights

- Email/password authentication, Google Sign-In, refresh-token rotation, logout, password reset, and account lockout
- Multi-tenant workspaces with member roles, invitations, plans, and audit logs
- Job management, structured scorecards, and background candidate sourcing
- Candidate search, filtering, pipeline transitions, AI scoring, comparison, decisions, overrides, reviews, tags, and notes
- Outreach, candidate replies, email templates, collaboration comments, and activity history
- Interview scheduling, invitations, transcripts, audio upload, AI analysis, evidence, and recommendations
- Hiring analytics, reports, PDF/CSV/chat exports, and privacy export/deletion
- BullMQ background jobs with Server-Sent Events for live task updates
- Local, S3-compatible, or Cloudinary file storage
- Groq, Gemini, OpenAI, and a no-key local AI fallback

## Demo data

Create a realistic workspace containing jobs, candidates, interviews, conversations, scorecards, analytics, and activity history:

```bash
pnpm seed
```

Then sign in with:

```text
Email:    demo@recruitai.local
Password: Demo1234!
```

The seed is intended for local testing or a dedicated demo environment. Do not seed a real production workspace.

## Technology

| Area           | Technology                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| Frontend       | React 18, Vite, TypeScript, React Router, TanStack Query, Zustand, React Hook Form, Recharts |
| Backend        | Node.js, Express, TypeScript, Mongoose, Zod                                                  |
| Database       | MongoDB                                                                                      |
| Queues         | BullMQ and Redis through `ioredis`                                                           |
| AI             | Groq, Google Gemini, OpenAI, local rule-based fallback                                       |
| Storage        | Local filesystem, Cloudinary, or S3-compatible object storage                                |
| Authentication | JWT access/refresh sessions, bcrypt, Google Identity Services                                |
| Email          | Nodemailer SMTP or zero-configuration preview delivery                                       |
| Tooling        | pnpm workspaces, Turborepo, Jest, Docker Compose                                             |

## Repository layout

```text
recruitAI/
├── apps/
│   ├── api/                 Express API, workers, models, and tests
│   └── web/                 React application
├── docker-compose.yml       Local development stack
├── docker-compose.prod.yml  Production-style container stack
└── turbo.json               Monorepo task configuration
```

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- Docker and Docker Compose, recommended for MongoDB and Redis

If necessary, enable the repository's pnpm version:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

## Quick start

### Option A: everything in Docker

```bash
cp .env.example .env
docker compose up --build
```

In another terminal, create the demo data:

```bash
docker compose exec api pnpm seed
```

### Option B: application locally, infrastructure in Docker

```bash
docker compose up -d mongo redis
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
```

In development, the API can run queue workers in-process, so `pnpm dev` is sufficient for the normal workflow. To test a separate worker, set `EMBEDDED_WORKERS=false` and run:

```bash
pnpm --filter @recruiting/api dev:worker
```

## Local URLs

| Service               | URL                                  |
| --------------------- | ------------------------------------ |
| Web application       | <http://localhost:5173>              |
| API                   | <http://localhost:5000>              |
| Swagger documentation | <http://localhost:5000/api/docs>     |
| Liveness check        | <http://localhost:5000/health/live>  |
| Readiness check       | <http://localhost:5000/health/ready> |
| Queue dashboard       | <http://localhost:5000/admin/queues> |
| Redis Commander       | <http://localhost:8081>              |

The queue dashboard requires an authenticated admin. Redis Commander is optional:

```bash
docker compose --profile debug up -d
```

## Environment configuration

Copy [`.env.example`](.env.example) to `.env`. These values are enough for local development:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret

MONGODB_URI=mongodb://localhost:27017/recruiting
REDIS_HOST=localhost
REDIS_PORT=6379

FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173
VITE_API_URL=http://localhost:5000

STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=/tmp/recruitai-storage
SOURCING_PROVIDER=mock
EMAIL_DELIVERY_MODE=preview
```

Generate a production secret with `openssl rand -base64 48`. Never commit `.env`, API keys, SMTP credentials, or OAuth secrets.

### Google Sign-In

Create an OAuth 2.0 Web Client in Google Cloud and use the same client ID in both applications:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Add the local and deployed frontend URLs to the OAuth client's authorized JavaScript origins. The button appears automatically when `VITE_GOOGLE_CLIENT_ID` exists; no feature flag is required.

### AI providers

All keys are optional. With an empty `ACTIVE_AI_PROVIDER`, RecruitAI selects the first configured provider:

```text
Groq -> Gemini -> OpenAI -> local fallback
```

```env
ACTIVE_AI_PROVIDER=
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

The local fallback keeps workflows testable without paid access, but it is less capable than a hosted model.

### Candidate sourcing

```env
# mock | duckduckgo | serper | puppeteer
SOURCING_PROVIDER=mock
SERPER_API_KEY=
```

Use `mock` for deterministic demos and tests. Before using a live provider, review its legal, privacy, and platform-policy requirements.

### Cloudinary storage

Free hosting filesystems are usually ephemeral. Use Cloudinary for persistent resume and interview-audio storage:

```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Files are stored as authenticated raw assets and downloaded with signed URLs. Current limits are 5 MB for resumes and 10 MB for Cloudinary-hosted audio.

### Redis and workers

`ioredis` is a client, not a Redis server. The production API Docker image can start a private ephemeral Redis process for one free web service. Run workers in the same process with:

```env
EMBEDDED_WORKERS=true
```

If managed Redis is available, use it instead:

```env
REDIS_URL=rediss://default:password@host:port
EMBEDDED_WORKERS=true
```

For horizontal scaling, use managed Redis and dedicated workers. Bundled Redis is limited to one instance and queued jobs are not durable across service restarts.

### Email delivery

Preview delivery needs no external service and will not fail deployment because SMTP is absent:

```env
EMAIL_DELIVERY_MODE=preview
```

Preview mode records delivery previews but does not send to real inboxes. For real delivery:

```env
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
ALERT_EMAIL_TO=alerts@example.com
```

S3 storage, Stripe billing, HTTP malware scanning, monitoring webhooks, metrics authentication, and email webhooks are also supported. See [`.env.example`](.env.example) for their variables.

## Core workflow

1. Register or sign in and enter a workspace.
2. Create a job and configure requirements and a scorecard.
3. Add candidates or launch a sourcing task.
4. Score candidates, review evidence, and move them through valid pipeline stages.
5. Send outreach and record responses.
6. Create interviews, send invitations, save transcripts/audio, and run analysis.
7. Compare candidates, document human overrides, and save decisions.
8. Review analytics, export reports, and use audit/privacy tools.

Pipeline transitions are validated by the backend. Dashboard stage labels act as filters; they do not arbitrarily rewrite candidate state.

## Commands

| Command              | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `pnpm dev`           | Run development services through Turborepo |
| `pnpm seed`          | Create realistic demo data                 |
| `pnpm typecheck`     | Type-check every workspace                 |
| `pnpm test`          | Run the API Jest suite                     |
| `pnpm build`         | Build every workspace                      |
| `pnpm verify`        | Run type-checking, tests, and builds       |
| `pnpm smoke:backend` | Run the backend smoke test                 |
| `pnpm format`        | Format source and documentation files      |

Individual workspaces can also be run directly:

```bash
pnpm --filter @recruiting/api dev
pnpm --filter @recruiting/api dev:worker
pnpm --filter @recruiting/web dev
```

## API conventions

Protected endpoints expect:

```http
Authorization: Bearer <access-token>
```

APIs cover authentication, organizations, jobs, candidates, interviews, tasks, messages, templates, reports, analytics, billing, files, notifications, audit records, and public contact/demo requests. Use Swagger locally for complete schemas. Production documentation is disabled unless `API_DOCS_ENABLED=true` is explicitly set.

## Testing and verification

Before a pull request or deployment, run:

```bash
pnpm verify
```

This type-checks all workspaces, runs backend tests, and creates production builds. Tests use an in-memory MongoDB instance where appropriate and do not modify the development database.

After deployment, check:

```bash
curl https://your-api.example.com/health/live
curl https://your-api.example.com/health/ready
```

Then test registration/login, Google Sign-In, a background task, file upload/download, logout, and frontend refresh on a nested route.

## Free deployment

Recommended topology:

- Render Static Site for `apps/web`
- Render Docker Web Service for `apps/api`
- MongoDB Atlas free cluster
- Cloudinary free account for persistent files
- Bundled ephemeral Redis and embedded workers for a single demo instance
- Preview email until SMTP is configured

Deployment essentials:

- Set `VITE_API_URL` before building the frontend.
- Set `FRONTEND_URL` and `FRONTEND_URLS` to the final HTTPS frontend origin.
- Use Cloudinary or S3 instead of an ephemeral container filesystem.
- Configure SPA rewrites so `/jobs/:id` and `/candidates/:id` return `index.html`.
- Free services may sleep, restart, or lose bundled Redis queues; use managed infrastructure for durable workloads.

## Security and privacy

- Passwords are bcrypt-hashed and refresh sessions are revocable.
- APIs use tenant scoping, validation, rate limiting, Helmet, and explicit CORS origins.
- Sensitive candidate actions create audit records.
- Candidate privacy data can be exported or deleted through protected workflows.
- Uploads use validated types and configurable malware scanning.
- AI output is decision support; final decisions require human review.

These controls do not automatically provide legal compliance. Review employment, privacy, retention, accessibility, anti-discrimination, and sourcing rules for every jurisdiction where RecruitAI is used.

## Operational limitations

- Preview email does not deliver to real inboxes.
- Bundled Redis is ephemeral and intended for one free demo instance.
- Local AI fallback is for testing, not equivalent to a hosted LLM.
- Live sourcing quality and availability depend on the provider.
- Manual billing simulates plan changes; Stripe is required for real checkout.

These fallbacks let the full product be demonstrated without paid infrastructure while production integrations remain configurable through environment variables.
