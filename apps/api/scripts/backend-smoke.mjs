import 'dotenv/config';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const API_DIR = path.resolve(__dirname, '..');
const EXPLICIT_API_BASE_URL = Boolean(process.env.API_BASE_URL);
const API_BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;
const MONGODB_URI = process.env.MONGODB_URI;
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emailPrefix = `smoke-backend-${stamp}`;
let startedApiProcess;
const apiLogs = [];

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required for smoke-test seed and cleanup.');
}

const state = {
    userIds: [],
    organizationIds: [],
    membershipIds: [],
    jobIds: [],
    candidateIds: [],
    interviewIds: [],
    taskIds: [],
    fileIds: [],
    reportIds: [],
    evaluationIds: [],
    commentIds: [],
    reviewIds: [],
    emails: [],
};

const results = [];
const skipped = [
    'POST /api/auth/google (external Google credential required)',
    'POST /api/billing/webhook (Stripe signed payload required)',
];

function remember(key, value) {
    if (!value) return value;
    const id = String(value);
    if (!state[key].includes(id)) state[key].push(id);
    return id;
}

function dataOf(body) {
    return body?.data ?? body;
}

function idOf(value) {
    return value?._id ?? value?.id ?? value?.taskId ?? value?.data?._id ?? value?.data?.id ?? value?.data?.taskId;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertObject(value, label) {
    assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
    return value;
}

function assertArray(value, label) {
    assert(Array.isArray(value), `${label} must be an array`);
    return value;
}

function assertString(value, label) {
    assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
    return value;
}

function assertId(value, label) {
    const id = assertString(String(value ?? ''), label);
    assert(/^[a-f\d]{24}$/i.test(id), `${label} must be a Mongo ObjectId`);
    return id;
}

function assertFields(object, fields, label) {
    assertObject(object, label);
    for (const field of fields) {
        assert(object[field] !== undefined && object[field] !== null, `${label}.${field} is required`);
    }
    return object;
}

function assertApiEnvelope(body, label) {
    assertObject(body, label);
    assert(body.success === true, `${label}.success must be true`);
    assert('data' in body, `${label}.data is required`);
    return body.data;
}

function assertAuthPayload(body, label) {
    const data = assertApiEnvelope(body, label);
    assertFields(data, ['user', 'token', 'refreshToken'], `${label}.data`);
    assertFields(data.user, ['email', 'role'], `${label}.data.user`);
    assertId(data.user.id ?? data.user._id, `${label}.data.user.id`);
    assertString(data.token, `${label}.data.token`);
    assertString(data.refreshToken, `${label}.data.refreshToken`);
    assertId(data.user.defaultOrganizationId, `${label}.data.user.defaultOrganizationId`);
    return data;
}

async function http(method, endpoint, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    let body;
    if (options.body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
        body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body,
        signal: options.signal,
    });

    const contentType = res.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await res.json() : await res.text();
    const expected = options.expected ?? [200];
    if (!expected.includes(res.status)) {
        throw new Error(
            `${method} ${endpoint} expected ${expected.join('/')} but got ${res.status}: ${
                typeof payload === 'string' ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 300)
            }`
        );
    }
    if (
        contentType.includes('application/json') &&
        endpoint.startsWith('/api/') &&
        !endpoint.startsWith('/api/docs') &&
        options.apiContract !== false
    ) {
        assertApiEnvelope(payload, `${method} ${endpoint} response`);
    }
    options.validate?.(payload, res);
    return { res, body: payload };
}

async function check(name, fn) {
    const started = Date.now();
    try {
        const detail = await fn();
        results.push({ name, status: 'PASS', ms: Date.now() - started, detail });
        console.log(`PASS ${name}`);
        return detail;
    } catch (error) {
        results.push({ name, status: 'FAIL', ms: Date.now() - started, detail: error.message });
        console.error(`FAIL ${name}`);
        console.error(error.stack ?? error.message);
        throw error;
    }
}

function authHeaders(token) {
    return { Authorization: `Bearer ${token}` };
}

async function fetchHealth(timeoutMs = 1200) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function ensureApiServer() {
    if (await fetchHealth()) return;

    if (EXPLICIT_API_BASE_URL || process.env.SMOKE_AUTO_START_API === 'false') {
        throw new Error(
            `API is not reachable at ${API_BASE_URL}. Start the API first with "pnpm --filter @recruiting/api dev" or unset API_BASE_URL to allow local auto-start.`
        );
    }

    console.log(`API not reachable at ${API_BASE_URL}; starting local API dev server...`);
    startedApiProcess = spawn('pnpm', ['dev'], {
        cwd: API_DIR,
        env: process.env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const collectLog = chunk => {
        for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
            apiLogs.push(line);
            if (apiLogs.length > 80) apiLogs.shift();
        }
    };
    startedApiProcess.stdout.on('data', collectLog);
    startedApiProcess.stderr.on('data', collectLog);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 60000) {
        if (startedApiProcess.exitCode !== null) {
            throw new Error(
                `API dev server exited before becoming healthy.\n${apiLogs.slice(-30).join('\n')}`
            );
        }
        if (await fetchHealth(1000)) {
            console.log('Local API dev server is healthy.');
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(
        `Timed out waiting for API health at ${API_BASE_URL}.\n${apiLogs.slice(-30).join('\n')}`
    );
}

async function stopApiServer() {
    if (!startedApiProcess?.pid) return;

    const pid = startedApiProcess.pid;
    const killGroup = signal => {
        try {
            process.kill(-pid, signal);
        } catch {
            try {
                startedApiProcess.kill(signal);
            } catch {
                // The process may already be gone.
            }
        }
    };

    killGroup('SIGINT');
    await new Promise(resolve => {
        const forceTimeout = setTimeout(() => {
            killGroup('SIGTERM');
            resolve();
        }, 5000);

        startedApiProcess.once('exit', () => {
            clearTimeout(forceTimeout);
            resolve();
        });
    });
}

async function registerUser(email, name) {
    state.emails.push(email);
    const { body } = await http('POST', '/api/auth/register', {
        expected: [201],
        body: { name, email, password: 'Password123!', role: 'recruiter' },
        validate: payload => assertAuthPayload(payload, 'register response'),
    });
    const payload = assertAuthPayload(body, 'register response');
    remember('userIds', payload.user?.id ?? payload.user?._id);
    remember('organizationIds', payload.user?.defaultOrganizationId);
    return payload;
}

async function readSse(endpoint, token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: authHeaders(token),
            signal: controller.signal,
        });
        if (res.status !== 200) throw new Error(`${endpoint} returned ${res.status}`);
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
            throw new Error(`${endpoint} content-type was ${contentType}`);
        }
        const reader = res.body?.getReader();
        if (!reader) return 'opened';
        await Promise.race([
            reader.read(),
            new Promise(resolve => setTimeout(resolve, 700)),
        ]);
        await reader.cancel().catch(() => undefined);
        return 'opened';
    } catch (error) {
        if (error.name === 'AbortError') return 'opened';
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function cleanup() {
    const db = mongoose.connection.db;
    if (!db) return;

    const objectIds = values =>
        values.filter(Boolean).map(value => new mongoose.Types.ObjectId(String(value)));

    const orgIds = objectIds(state.organizationIds);
    const userIds = objectIds(state.userIds);
    const jobIds = objectIds(state.jobIds);
    const candidateIds = objectIds(state.candidateIds);
    const interviewIds = objectIds(state.interviewIds);
    const taskIds = objectIds(state.taskIds);
    const fileIds = objectIds(state.fileIds);
    const reportIds = objectIds(state.reportIds);
    const evaluationIds = objectIds(state.evaluationIds);
    const commentIds = objectIds(state.commentIds);
    const reviewIds = objectIds(state.reviewIds);

    await Promise.allSettled([
        db.collection('messages').deleteMany({
            $or: [{ candidateId: { $in: candidateIds } }, { jobId: { $in: jobIds } }],
        }),
        db.collection('transcriptsegments').deleteMany({ interviewId: { $in: interviewIds } }),
        db.collection('interviewanalyses').deleteMany({
            $or: [{ interviewId: { $in: interviewIds } }, { candidateId: { $in: candidateIds } }],
        }),
        db.collection('interviews').deleteMany({ _id: { $in: interviewIds } }),
        db.collection('evaluations').deleteMany({
            $or: [{ _id: { $in: evaluationIds } }, { candidateId: { $in: candidateIds } }, { jobId: { $in: jobIds } }],
        }),
        db.collection('jobscorecards').deleteMany({ jobId: { $in: jobIds } }),
        db.collection('candidatereports').deleteMany({
            $or: [{ _id: { $in: reportIds } }, { candidateId: { $in: candidateIds } }, { jobId: { $in: jobIds } }],
        }),
        db.collection('comments').deleteMany({
            $or: [{ _id: { $in: commentIds } }, { resourceId: { $in: [...candidateIds, ...jobIds].map(String) } }],
        }),
        db.collection('reviews').deleteMany({
            $or: [{ _id: { $in: reviewIds } }, { resourceId: { $in: [...candidateIds, ...jobIds].map(String) } }],
        }),
        db.collection('auditlogs').deleteMany({
            $or: [{ resourceId: { $in: [...candidateIds, ...jobIds].map(String) } }, { userId: { $in: userIds } }],
        }),
        db.collection('fileassets').deleteMany({
            $or: [{ _id: { $in: fileIds } }, { ownerId: { $in: candidateIds.map(String) } }],
        }),
        db.collection('tasks').deleteMany({
            $or: [{ _id: { $in: taskIds } }, { candidateId: { $in: candidateIds } }, { jobId: { $in: jobIds } }, { interviewId: { $in: interviewIds } }],
        }),
        db.collection('candidates').deleteMany({ _id: { $in: candidateIds } }),
        db.collection('jobs').deleteMany({ _id: { $in: jobIds } }),
        db.collection('memberships').deleteMany({
            $or: [{ _id: { $in: objectIds(state.membershipIds) } }, { userId: { $in: userIds } }, { organizationId: { $in: orgIds } }],
        }),
        db.collection('organizations').deleteMany({ _id: { $in: orgIds } }),
        db.collection('sessions').deleteMany({ userId: { $in: userIds } }),
        db.collection('users').deleteMany({ _id: { $in: userIds } }),
        db.collection('demorequests').deleteMany({ email: { $in: state.emails } }),
    ]);
}

async function main() {
    await mongoose.connect(MONGODB_URI);
    await ensureApiServer();

    let token;
    let refreshToken;
    let owner;
    let teammate;
    let jobId;
    let candidateOneId;
    let candidateTwoId;
    let interviewId;

    try {
        await check('GET /health', async () => (await http('GET', '/health')).body);
        await check('GET /health/live', async () => (await http('GET', '/health/live')).body);
        await check('GET /health/ready', async () => (await http('GET', '/health/ready')).body);
        await check('GET /api/docs', async () => (await http('GET', '/api/docs/', { expected: [200, 301] })).res.status);

        await check('POST /api/public/demo-requests', async () => {
            const email = `${emailPrefix}-demo@example.com`;
            state.emails.push(email);
            return (await http('POST', '/api/public/demo-requests', {
                expected: [201],
                body: {
                    name: 'Smoke Demo Lead',
                    email,
                    company: 'Smoke QA',
                    role: 'Founder',
                    message: 'We want to validate the recruiting automation workflow.',
                    sourcePage: '/smoke',
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'demo request response');
                    assertFields(data, ['_id', 'email', 'type', 'status'], 'demo request data');
                    assert(data.email === email, 'demo request email mismatch');
                },
            })).body;
        });

        await check('POST /api/public/contact', async () => {
            const email = `${emailPrefix}-contact@example.com`;
            state.emails.push(email);
            return (await http('POST', '/api/public/contact', {
                expected: [201],
                body: {
                    name: 'Smoke Contact Lead',
                    email,
                    company: 'Smoke QA',
                    role: 'Recruiter',
                    message: 'Please contact us about production readiness smoke testing.',
                    sourcePage: '/contact',
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'contact request response');
                    assertFields(data, ['_id', 'email', 'type', 'status'], 'contact request data');
                    assert(data.email === email, 'contact request email mismatch');
                },
            })).body;
        });

        owner = await check('POST /api/auth/register', () =>
            registerUser(`${emailPrefix}-owner@example.com`, 'Smoke Owner')
        );
        token = owner.token;
        refreshToken = owner.refreshToken;

        await check('POST /api/auth/password-reset/request', async () => {
            const { body } = await http('POST', '/api/auth/password-reset/request', {
                body: { email: owner.user.email },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'password reset request response');
                    assertString(data.message, 'password reset request data.message');
                },
            });
            const resetToken = dataOf(body).resetToken;
            if (resetToken) {
                await http('POST', '/api/auth/password-reset/confirm', {
                    body: { token: resetToken, password: 'NewPassword123!' },
                    validate: payload => assertString(assertApiEnvelope(payload, 'password reset confirm response').message, 'password reset confirm message'),
                });
                const login = await http('POST', '/api/auth/login', {
                    body: { email: owner.user.email, password: 'NewPassword123!' },
                    validate: payload => assertAuthPayload(payload, 'password-reset login response'),
                });
                token = assertAuthPayload(login.body, 'password-reset login response').token;
                refreshToken = assertAuthPayload(login.body, 'password-reset login response').refreshToken;
            }
            return resetToken ? 'request+confirm' : 'request-only';
        });

        await check('POST /api/auth/login', async () => {
            const { body } = await http('POST', '/api/auth/login', {
                body: { email: owner.user.email, password: 'NewPassword123!' },
                validate: payload => assertAuthPayload(payload, 'login response'),
            });
            token = assertAuthPayload(body, 'login response').token;
            refreshToken = assertAuthPayload(body, 'login response').refreshToken;
            return 'logged in';
        });

        await check('Promote smoke user to admin for admin API coverage', async () => {
            await mongoose.connection.db.collection('users').updateOne(
                { _id: new mongoose.Types.ObjectId(owner.user.id) },
                { $set: { role: 'admin' } }
            );
            const { body } = await http('POST', '/api/auth/login', {
                body: { email: owner.user.email, password: 'NewPassword123!' },
                validate: payload => assertAuthPayload(payload, 'admin login response'),
            });
            token = assertAuthPayload(body, 'admin login response').token;
            refreshToken = assertAuthPayload(body, 'admin login response').refreshToken;
            return 'admin token issued';
        });

        await check('GET /api/auth/me', async () =>
            (await http('GET', '/api/auth/me', {
                headers: authHeaders(token),
                validate: payload => assertFields(assertApiEnvelope(payload, 'me response'), ['email', 'role'], 'me data'),
            })).body
        );
        await check('POST /api/auth/refresh', async () => {
            const { body } = await http('POST', '/api/auth/refresh', {
                body: { refreshToken },
                validate: payload => assertAuthPayload(payload, 'refresh response'),
            });
            token = assertAuthPayload(body, 'refresh response').token;
            refreshToken = assertAuthPayload(body, 'refresh response').refreshToken;
            return 'refreshed';
        });
        await check('GET /api/admin/demo-requests', async () =>
            (await http('GET', '/api/admin/demo-requests?limit=5', {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'admin demo requests response');
                    assertArray(data.data ?? data, 'admin demo requests list');
                },
            })).body
        );

        teammate = await check('Register teammate for org invite flow', () =>
            registerUser(`${emailPrefix}-teammate@example.com`, 'Smoke Teammate')
        );

        await check('GET /api/organizations', async () =>
            (await http('GET', '/api/organizations', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'organizations response').memberships, 'organizations memberships'),
            })).body
        );
        await check('GET /api/organizations/current', async () =>
            (await http('GET', '/api/organizations/current', {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'current organization response');
                    assertId(data._id, 'current organization id');
                    assertString(data.slug, 'current organization slug');
                },
            })).body
        );
        await check('POST /api/organizations/current/invites + accept + patch member', async () => {
            const invite = await http('POST', '/api/organizations/current/invites', {
                expected: [201],
                headers: authHeaders(token),
                body: { email: teammate.user.email, role: 'viewer' },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'invite response');
                    assertId(data._id, 'invite membership id');
                    assertString(data.inviteToken, 'invite token');
                    assert(data.status === 'invited', 'invite status must be invited');
                },
            });
            remember('membershipIds', idOf(dataOf(invite.body)));

            await http('POST', '/api/organizations/invites/accept', {
                headers: authHeaders(teammate.token),
                body: { token: dataOf(invite.body).inviteToken },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'accept invite response');
                    assert(data.status === 'active', 'accepted membership status must be active');
                },
            });

            const members = await http('GET', '/api/organizations/current/members', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'members response'), 'members data'),
            });
            const teammateMembership = dataOf(members.body).find(member => member.user?.email === teammate.user.email);
            assert(teammateMembership, 'teammate membership must be present after invite accept');
            remember('membershipIds', teammateMembership?._id);

            await http('PATCH', `/api/organizations/current/members/${teammateMembership._id}`, {
                headers: authHeaders(token),
                body: { status: 'disabled' },
                validate: payload => assert(assertApiEnvelope(payload, 'patch member response').status === 'disabled', 'patched membership status must be disabled'),
            });
            return 'invite accepted and disabled';
        });
        await check('GET /api/organizations/current/members', async () =>
            (await http('GET', '/api/organizations/current/members', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'members response'), 'members data'),
            })).body
        );
        await check('POST /api/billing/checkout + GET /api/billing/status', async () => {
            await http('POST', '/api/billing/checkout', {
                expected: [201],
                headers: authHeaders(token),
                body: { plan: 'pro' },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'billing checkout response');
                    assert(data.plan === 'pro', 'billing checkout plan must be pro');
                    assert(['manual', 'stripe'].includes(data.mode), 'billing checkout mode must be manual or stripe');
                    assertString(data.checkoutUrl, 'billing checkout checkoutUrl');
                },
            });
            return (await http('GET', '/api/billing/status', {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'billing status response');
                    assert(data.plan === 'pro', 'billing status plan must be pro');
                    assert(data.subscriptionStatus === 'active', 'billing status subscriptionStatus must be active');
                },
            })).body;
        });

        await check('POST /api/jobs', async () => {
            const { body } = await http('POST', '/api/jobs', {
                expected: [201],
                headers: authHeaders(token),
                body: {
                    title: `Smoke Product Engineer ${stamp}`,
                    description: 'Build production-grade recruiting workflows with React, Node.js, MongoDB, and AI.',
                    requirements: ['React', 'Node.js', 'MongoDB', 'AI evaluation'],
                    location: 'Remote',
                    type: 'full-time',
                    status: 'active',
                    sourcingQueries: ['React Node.js engineer remote'],
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'create job response');
                    assertId(data._id, 'created job id');
                    assert(data.title.includes('Smoke Product Engineer'), 'created job title mismatch');
                    assert(data.status === 'active', 'created job status must be active');
                },
            });
            jobId = remember('jobIds', idOf(dataOf(body)));
            return body;
        });
        await check('GET /api/jobs', async () =>
            (await http('GET', '/api/jobs?limit=10', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'jobs list response'), 'jobs list data'),
            })).body
        );
        await check('GET/PATCH/stats/duplicate/DELETE /api/jobs/:id', async () => {
            await http('GET', `/api/jobs/${jobId}`, {
                headers: authHeaders(token),
                validate: payload => assert(assertApiEnvelope(payload, 'job detail response')._id === jobId, 'job detail id mismatch'),
            });
            await http('PATCH', `/api/jobs/${jobId}`, {
                headers: authHeaders(token),
                body: { status: 'paused', location: 'Remote - Smoke' },
                validate: payload => assert(assertApiEnvelope(payload, 'job patch response').status === 'paused', 'patched job status must be paused'),
            });
            await http('GET', `/api/jobs/${jobId}/stats`, {
                headers: authHeaders(token),
                validate: payload => assertObject(assertApiEnvelope(payload, 'job stats response'), 'job stats data'),
            });
            const duplicate = await http('POST', `/api/jobs/${jobId}/duplicate`, {
                expected: [201],
                headers: authHeaders(token),
                validate: payload => assertId(assertApiEnvelope(payload, 'duplicate job response')._id, 'duplicate job id'),
            });
            const duplicateId = remember('jobIds', idOf(dataOf(duplicate.body)));
            await http('DELETE', `/api/jobs/${duplicateId}`, {
                headers: authHeaders(token),
                validate: payload => assertString(assertApiEnvelope(payload, 'delete job response').message, 'delete job message'),
            });
            return 'job detail/update/stats/duplicate/delete ok';
        });

        await check('Seed candidates for candidate/evaluation/report flows', async () => {
            const orgId = new mongoose.Types.ObjectId(owner.user.defaultOrganizationId);
            const candidateResult = await mongoose.connection.db.collection('candidates').insertMany([
                {
                    organizationId: orgId,
                    jobId: new mongoose.Types.ObjectId(jobId),
                    name: 'Asha Smoke',
                    email: `${emailPrefix}-asha@example.com`,
                    linkedinUrl: `https://linkedin.com/in/asha-smoke-${stamp}`,
                    headline: 'Senior Product Engineer',
                    summary: 'Strong React, Node.js, MongoDB, architecture, and communication evidence.',
                    skills: ['React', 'Node.js', 'MongoDB', 'Architecture', 'Communication'],
                    experience: '7 years',
                    location: 'Remote',
                    source: 'manual',
                    status: 'scored',
                    starred: false,
                    tags: [],
                    notes: '',
                    score: {
                        value: 88,
                        reasoning: 'Excellent smoke profile match.',
                        strengths: ['React', 'Node.js', 'Architecture'],
                        weaknesses: ['Needs domain deep dive'],
                        cachedAt: new Date(),
                        source: 'fallback',
                    },
                    scoredAt: new Date(),
                    outreachMessages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    organizationId: orgId,
                    jobId: new mongoose.Types.ObjectId(jobId),
                    name: 'Rafi Smoke',
                    email: `${emailPrefix}-rafi@example.com`,
                    linkedinUrl: `https://linkedin.com/in/rafi-smoke-${stamp}`,
                    headline: 'Backend Engineer',
                    summary: 'Good Node.js and MongoDB evidence with lighter frontend experience.',
                    skills: ['Node.js', 'MongoDB', 'Redis'],
                    experience: '5 years',
                    location: 'Remote',
                    source: 'manual',
                    status: 'scored',
                    starred: false,
                    tags: [],
                    notes: '',
                    score: {
                        value: 71,
                        reasoning: 'Partial smoke profile match.',
                        strengths: ['Node.js', 'MongoDB'],
                        weaknesses: ['React depth'],
                        cachedAt: new Date(),
                        source: 'fallback',
                    },
                    scoredAt: new Date(),
                    outreachMessages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]);
            candidateOneId = remember('candidateIds', candidateResult.insertedIds[0]);
            candidateTwoId = remember('candidateIds', candidateResult.insertedIds[1]);
            return `${candidateOneId}, ${candidateTwoId}`;
        });

        await check('GET /api/jobs/:jobId/candidates and GET /api/candidates', async () => {
            await http('GET', `/api/jobs/${jobId}/candidates`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'job candidates response'), 'job candidates data'),
            });
            return (await http('GET', `/api/candidates?jobId=${jobId}&limit=10`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'all candidates response'), 'all candidates data'),
            })).body;
        });
        await check('GET/PATCH /api/candidates/:id', async () => {
            await http('GET', `/api/candidates/${candidateOneId}`, {
                headers: authHeaders(token),
                validate: payload => assert(assertApiEnvelope(payload, 'candidate detail response')._id === candidateOneId, 'candidate detail id mismatch'),
            });
            return (await http('PATCH', `/api/candidates/${candidateOneId}`, {
                headers: authHeaders(token),
                body: { status: 'interested', tags: ['smoke'], notes: 'Smoke update verified.', starred: true },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'candidate patch response');
                    assert(data._id === candidateOneId, 'candidate patch id mismatch');
                    assert(data.status === 'interested', 'candidate patch status must be interested');
                    assert(data.starred === true, 'candidate patch starred must be true');
                },
            })).body;
        });
        await check('POST response + GET messages /api/candidates/:id', async () => {
            await http('POST', `/api/candidates/${candidateOneId}/responses`, {
                headers: authHeaders(token),
                body: { message: 'Thanks, I am interested in this role and available next week.' },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'candidate response classification response');
                    assertString(data.intent, 'candidate response intent');
                    assert(typeof data.confidence === 'number', 'candidate response confidence must be numeric');
                    assertString(data.candidateStatus, 'candidate response candidateStatus');
                },
            });
            return (await http('GET', `/api/candidates/${candidateOneId}/messages`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'candidate messages response'), 'candidate messages data'),
            })).body;
        });
        await check('POST /api/candidates/:id/scores and outreach', async () => {
            const score = await http('POST', `/api/candidates/${candidateOneId}/scores?refresh=true`, {
                expected: [200, 202],
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'candidate score response');
                    if ('taskId' in data) assertId(data.taskId, 'candidate score taskId');
                    else assert(typeof data.value === 'number', 'candidate score value must be numeric');
                },
            });
            remember('taskIds', idOf(dataOf(score.body)));
            const outreach = await http('POST', `/api/candidates/${candidateOneId}/outreach`, {
                expected: [202],
                headers: authHeaders(token),
                body: { jobId },
                validate: payload => assertId(assertApiEnvelope(payload, 'candidate outreach response').taskId, 'candidate outreach taskId'),
            });
            remember('taskIds', idOf(dataOf(outreach.body)));
            return 'score/outreach ok';
        });

        await check('POST/GET/download /api/files', async () => {
            const upload = await http('POST', '/api/files', {
                expected: [201],
                headers: authHeaders(token),
                body: {
                    ownerType: 'candidate',
                    ownerId: candidateOneId,
                    kind: 'resume',
                    filename: 'smoke-resume.txt',
                    mimeType: 'text/plain',
                    contentBase64: Buffer.from('Smoke resume with React, Node.js, MongoDB.').toString('base64'),
                    extractedText: 'Smoke resume with React, Node.js, MongoDB.',
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'file upload response');
                    assertId(data._id, 'file id');
                    assert(data.ownerId === candidateOneId, 'file ownerId mismatch');
                    assert(data.filename === 'smoke-resume.txt', 'file filename mismatch');
                },
            });
            const fileId = remember('fileIds', idOf(dataOf(upload.body)));
            await http('GET', `/api/files?ownerType=candidate&ownerId=${candidateOneId}`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'files list response'), 'files list data'),
            });
            const download = await http('GET', `/api/files/${fileId}/download`, {
                headers: authHeaders(token),
                validate: (_payload, res) => assert((res.headers.get('content-type') ?? '').includes('text/plain'), 'file download content-type must be text/plain'),
            });
            if (!String(download.body).includes('Smoke resume')) throw new Error('download body missing resume text');
            return 'file upload/list/download ok';
        });

        await check('POST/GET/PATCH/transcript/analyze /api/interviews', async () => {
            const create = await http('POST', '/api/interviews', {
                expected: [201],
                headers: authHeaders(token),
                body: {
                    jobId,
                    candidateId: candidateOneId,
                    title: 'Smoke Technical Interview',
                    round: 'Round 1',
                    type: 'technical',
                    transcriptText: [
                        'Interviewer: Tell me about a system you designed.',
                        'Candidate: I built Node.js APIs with MongoDB and Redis-backed queues.',
                    ].join('\n'),
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'create interview response');
                    assertId(data._id, 'interview id');
                    assert(data.jobId === jobId, 'interview jobId mismatch');
                    assert(data.candidateId === candidateOneId, 'interview candidateId mismatch');
                },
            });
            interviewId = remember('interviewIds', idOf(dataOf(create.body)));
            await http('GET', '/api/interviews', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'interviews list response'), 'interviews list data'),
            });
            await http('GET', `/api/interviews/${interviewId}`, {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'interview detail response');
                    assert(data.interview?._id === interviewId, 'interview detail id mismatch');
                    assertArray(data.transcriptSegments, 'interview detail transcriptSegments');
                },
            });
            await http('PATCH', `/api/interviews/${interviewId}`, {
                headers: authHeaders(token),
                body: { notes: 'Smoke interview note', status: 'completed' },
                validate: payload => assert(assertApiEnvelope(payload, 'patch interview response')._id === interviewId, 'patch interview id mismatch'),
            });
            await http('POST', `/api/interviews/${interviewId}/transcript`, {
                headers: authHeaders(token),
                body: {
                    transcriptText: [
                        'Interviewer: What would you improve?',
                        'Candidate: I would add tracing and stronger observability.',
                    ].join('\n'),
                },
                validate: payload => assertArray(assertApiEnvelope(payload, 'replace transcript response').transcriptSegments, 'transcript segments'),
            });
            const analyze = await http('POST', `/api/interviews/${interviewId}/analyze`, {
                expected: [202],
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'analyze interview response');
                    assertId(data.taskId, 'analyze interview taskId');
                    assert(data.status === 'queued', 'analyze interview status must be queued');
                },
            });
            remember('taskIds', idOf(dataOf(analyze.body)));
            return 'interview flow ok';
        });

        await check('GET/PUT/POST/GET/compare evaluations', async () => {
            await http('GET', `/api/jobs/${jobId}/scorecard`, {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'scorecard response');
                    assertArray(data.competencies, 'scorecard competencies');
                    assert(typeof data.passingScore === 'number', 'scorecard passingScore must be numeric');
                },
            });
            await http('PUT', `/api/jobs/${jobId}/scorecard`, {
                headers: authHeaders(token),
                body: {
                    name: 'Smoke Product Engineer Scorecard',
                    passingScore: 72,
                    competencies: [
                        { id: 'frontend', name: 'Frontend depth', description: 'React delivery.', weight: 30 },
                        { id: 'backend', name: 'Backend depth', description: 'Node.js API design.', weight: 30 },
                        { id: 'architecture', name: 'Architecture', description: 'System design ownership.', weight: 25 },
                        { id: 'communication', name: 'Communication', description: 'Clear collaboration.', weight: 15 },
                    ],
                },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'upsert scorecard response');
                    assert(data.name === 'Smoke Product Engineer Scorecard', 'scorecard name mismatch');
                    assertArray(data.competencies, 'upsert scorecard competencies');
                    assert(data.competencies.length === 4, 'upsert scorecard must have four competencies');
                },
            });
            const evaluation = await http('POST', `/api/jobs/${jobId}/evaluations`, {
                expected: [201],
                headers: authHeaders(token),
                body: { candidateId: candidateOneId },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'evaluation response');
                    assertId(data._id, 'evaluation id');
                    assert(data.candidateId === candidateOneId, 'evaluation candidateId mismatch');
                    assert(typeof data.overallScore === 'number', 'evaluation overallScore must be numeric');
                    assertArray(data.competencyScores, 'evaluation competencyScores');
                },
            });
            remember('evaluationIds', idOf(dataOf(evaluation.body)));
            await http('GET', `/api/jobs/${jobId}/evaluations`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'evaluations list response'), 'evaluations list data'),
            });
            return (await http('GET', `/api/jobs/${jobId}/compare?candidateIds=${candidateOneId},${candidateTwoId}`, {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'candidate compare response');
                    assertObject(data.scorecard, 'candidate compare scorecard');
                    assertArray(data.candidates, 'candidate compare candidates');
                    assert(data.candidates.length === 2, 'candidate compare must return two candidates');
                },
            })).body;
        });

        await check('POST/GET/download reports', async () => {
            const report = await http('POST', `/api/candidates/${candidateOneId}/reports`, {
                expected: [201],
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'generate report response');
                    assertId(data._id, 'report id');
                    assert(data.candidateId === candidateOneId, 'report candidateId mismatch');
                    assertString(data.reportMarkdown, 'report markdown');
                },
            });
            const reportId = remember('reportIds', idOf(dataOf(report.body)));
            await http('GET', `/api/candidates/${candidateOneId}/reports`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'candidate reports list response'), 'candidate reports list data'),
            });
            await http('GET', `/api/reports/${reportId}`, {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'report detail response');
                    assert(data._id === reportId, 'report detail id mismatch');
                    assertString(data.executiveSummary, 'report executiveSummary');
                },
            });
            const download = await http('GET', `/api/reports/${reportId}/download`, {
                headers: authHeaders(token),
                validate: (_payload, res) => assert((res.headers.get('content-type') ?? '').includes('text/markdown'), 'report download content-type must be text/markdown'),
            });
            if (!String(download.body).includes('Executive Summary')) throw new Error('report download missing markdown');
            return 'report flow ok';
        });

        await check('POST/GET comments, POST/GET/PATCH reviews, GET audit logs', async () => {
            const comment = await http('POST', `/api/collaboration/candidate/${candidateOneId}/comments`, {
                expected: [201],
                headers: authHeaders(token),
                body: { body: 'Smoke comment for candidate collaboration.', visibility: 'team' },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'create comment response');
                    assertId(data._id, 'comment id');
                    assert(data.resourceId === candidateOneId, 'comment resourceId mismatch');
                },
            });
            remember('commentIds', idOf(dataOf(comment.body)));
            await http('GET', `/api/collaboration/candidate/${candidateOneId}/comments`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'comments list response'), 'comments list data'),
            });

            const review = await http('POST', `/api/collaboration/candidate/${candidateOneId}/reviews`, {
                expected: [201],
                headers: authHeaders(token),
                body: { note: 'Smoke review request.', dueAt: new Date(Date.now() + 86400000).toISOString() },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'create review response');
                    assertId(data._id, 'review id');
                    assert(data.resourceId === candidateOneId, 'review resourceId mismatch');
                    assert(data.status === 'open', 'new review status must be open');
                },
            });
            const reviewId = remember('reviewIds', idOf(dataOf(review.body)));
            await http('GET', `/api/collaboration/candidate/${candidateOneId}/reviews`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'reviews list response'), 'reviews list data'),
            });
            await http('PATCH', `/api/collaboration/reviews/${reviewId}`, {
                headers: authHeaders(token),
                body: { status: 'approved', decision: 'yes', note: 'Smoke review completed.' },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'patch review response');
                    assert(data._id === reviewId, 'patch review id mismatch');
                    assert(data.status === 'approved', 'patch review status must be approved');
                    assert(data.decision === 'yes', 'patch review decision must be yes');
                },
            });
            return (await http('GET', `/api/audit-logs?resourceType=candidate&resourceId=${candidateOneId}`, {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'audit logs response'), 'audit logs data'),
            })).body;
        });

        await check('GET /api/queue-stats and /api/stats/global', async () => {
            await http('GET', '/api/queue-stats', {
                headers: authHeaders(token),
                validate: payload => assertArray(assertApiEnvelope(payload, 'queue stats response'), 'queue stats data'),
            });
            return (await http('GET', '/api/stats/global', {
                headers: authHeaders(token),
                validate: payload => assertObject(assertApiEnvelope(payload, 'global stats response'), 'global stats data'),
            })).body;
        });
        await check('POST /api/jobs/:jobId/sourcing-tasks', async () => {
            const sourcing = await http('POST', `/api/jobs/${jobId}/sourcing-tasks`, {
                expected: [202],
                headers: authHeaders(token),
                body: { query: 'React Node.js smoke engineer', limit: 1 },
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'sourcing task response');
                    assertId(data.taskId, 'sourcing taskId');
                    assert(data.status === 'queued', 'sourcing status must be queued');
                },
            });
            remember('taskIds', idOf(dataOf(sourcing.body)));
            return 'sourcing queued';
        });
        await check('GET /api/tasks/:taskId and /api/tasks/:taskId/stream', async () => {
            const taskId = state.taskIds.find(Boolean);
            if (!taskId) throw new Error('No queued task id was captured.');
            await http('GET', `/api/tasks/${taskId}`, {
                headers: authHeaders(token),
                validate: payload => {
                    const data = assertApiEnvelope(payload, 'task detail response');
                    assert(data._id === taskId, 'task detail id mismatch');
                    assertString(data.status, 'task status');
                },
            });
            return readSse(`/api/tasks/${taskId}/stream`, token);
        });
        await check('GET /api/stream/events', async () => readSse('/api/stream/events', token));

        await check('POST /api/auth/logout', async () =>
            (await http('POST', '/api/auth/logout', {
                headers: authHeaders(token),
                body: { refreshToken },
                validate: payload => assertString(assertApiEnvelope(payload, 'logout response').message, 'logout message'),
            })).body
        );

        console.log('\nBackend smoke test summary');
        console.log(`Base URL: ${API_BASE_URL}`);
        console.log(`Passed: ${results.filter(result => result.status === 'PASS').length}`);
        console.log(`Failed: ${results.filter(result => result.status === 'FAIL').length}`);
        console.log(`Skipped: ${skipped.length}`);
        skipped.forEach(item => console.log(`SKIP ${item}`));
    } finally {
        await cleanup();
        await mongoose.disconnect();
        await stopApiServer();
    }
}

main().catch(error => {
    console.error('\nBackend smoke test failed.');
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});
