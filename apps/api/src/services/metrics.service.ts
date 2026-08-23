type MethodStats = { count: number; errors: number; durationMs: number };

const startedAt = Date.now();
const requests = new Map<string, MethodStats>();
let aiProviderFailures = 0;
let taskFailures = 0;

export function recordRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
) {
    const normalizedRoute = route.split('?')[0].replace(/[a-f\d]{24}/gi, ':id');
    const key = `${method} ${normalizedRoute}`;
    const current = requests.get(key) ?? { count: 0, errors: 0, durationMs: 0 };
    current.count += 1;
    current.durationMs += durationMs;
    if (statusCode >= 500) current.errors += 1;
    requests.set(key, current);
}

export function recordAiProviderFailure() {
    aiProviderFailures += 1;
}

export function recordTaskFailure() {
    taskFailures += 1;
}

function label(value: string | undefined) {
    return String(value ?? 'unknown')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

export function renderMetrics(
    queueStats: { name: string; waiting: number; active: number; failed: number }[],
    persistedTaskFailures = taskFailures,
    persistedAiFailures = aiProviderFailures
) {
    const lines = [
        '# HELP recruitai_uptime_seconds Process uptime in seconds',
        '# TYPE recruitai_uptime_seconds gauge',
        `recruitai_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
        '# HELP recruitai_ai_provider_failures_total AI provider failures',
        '# TYPE recruitai_ai_provider_failures_total counter',
        `recruitai_ai_provider_failures_total ${persistedAiFailures}`,
        '# HELP recruitai_task_failures_total Background task failures',
        '# TYPE recruitai_task_failures_total counter',
        `recruitai_task_failures_total ${persistedTaskFailures}`,
    ];
    for (const [key, stats] of requests) {
        const separator = key.indexOf(' ');
        const method = key.slice(0, separator);
        const route = key.slice(separator + 1);
        const labels = `method="${label(method)}",route="${label(route)}"`;
        lines.push(`recruitai_http_requests_total{${labels}} ${stats.count}`);
        lines.push(`recruitai_http_errors_total{${labels}} ${stats.errors}`);
        lines.push(`recruitai_http_request_duration_ms_sum{${labels}} ${stats.durationMs}`);
    }
    for (const queue of queueStats) {
        const queueLabel = `queue="${label(queue.name)}"`;
        lines.push(`recruitai_queue_waiting{${queueLabel}} ${queue.waiting}`);
        lines.push(`recruitai_queue_active{${queueLabel}} ${queue.active}`);
        lines.push(`recruitai_queue_failed{${queueLabel}} ${queue.failed}`);
    }
    return `${lines.join('\n')}\n`;
}
