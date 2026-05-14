import { Queue } from 'bullmq';
import { bullRedis } from '@/config/redis';

export interface SourcingJobData {
    taskId: string;
    jobId: string;
    query: string;
    limit: number;
}

export interface ScoringJobData {
    taskId: string;
    candidateId: string;
    jobId: string;
    forceRefresh?: boolean;
}

export interface OutreachJobData {
    taskId: string;
    candidateId: string;
    jobId: string;
}

const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential' as const,
        delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
};

export const sourcingQueue = new Queue<SourcingJobData>('sourcing', {
    connection: bullRedis,
    defaultJobOptions,
});

export const scoringQueue = new Queue<ScoringJobData>('scoring', {
    connection: bullRedis,
    defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 3,
    },
});

export const outreachQueue = new Queue<OutreachJobData>('outreach', {
    connection: bullRedis,
    defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 3,
    },
});

export const allQueues = [sourcingQueue, scoringQueue, outreachQueue];
