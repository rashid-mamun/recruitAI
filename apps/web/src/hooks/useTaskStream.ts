import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/services/auth';

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface TaskStreamState {
    taskId: string | null;
    status: TaskStatus | null;
    progress: number;
    result: Record<string, unknown> | null;
    error: string | null;
    connectionState: 'connected' | 'reconnecting' | 'disconnected';
}

const INITIAL_STATE: TaskStreamState = {
    taskId: null,
    status: null,
    progress: 0,
    result: null,
    error: null,
    connectionState: 'disconnected',
};

/**
 * Connects to GET /api/tasks/:taskId/stream via SSE.
 * Returns live task state updated by the server whenever the worker makes progress.
 */
export function useTaskStream(taskId: string | null) {
    const [state, setState] = useState<TaskStreamState>(INITIAL_STATE);
    const esRef = useRef<EventSource | null>(null);
    const retryRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!taskId) return;

        // Reset state for new task
        setState({
            taskId,
            status: 'queued',
            progress: 0,
            result: null,
            error: null,
            connectionState: 'reconnecting',
        });

        retryRef.current = 0;

        const connect = () => {
            const token = getToken();
            const url = token
                ? `/api/tasks/${taskId}/stream?token=${encodeURIComponent(token)}`
                : `/api/tasks/${taskId}/stream`;

            const es = new EventSource(url);
            esRef.current = es;

            es.onopen = () => {
                setState((prev) => ({ ...prev, connectionState: 'connected' }));
            };

            es.addEventListener('task_updated', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    setState({
                        taskId,
                        status: data.status,
                        progress: data.progress ?? 0,
                        result: data.result ?? null,
                        error: data.error ?? null,
                    });

                    if (data.status === 'completed' || data.status === 'failed') {
                        es.close();
                        setState((prev) => ({ ...prev, connectionState: 'disconnected' }));
                    }
                } catch {
                    // ignore malformed event
                }
            });

            es.onerror = () => {
                es.close();
                setState((prev) => ({ ...prev, connectionState: 'reconnecting' }));
                if (retryRef.current >= 3) {
                    setState((prev) => ({ ...prev, connectionState: 'disconnected' }));
                    return;
                }
                const attempt = retryRef.current;
                retryRef.current += 1;
                const delay = 2000 * Math.pow(2, attempt);
                retryTimerRef.current = setTimeout(connect, delay);
            };
        };

        connect();

        return () => {
            esRef.current?.close();
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
        };
    }, [taskId]);

    return state;
}
