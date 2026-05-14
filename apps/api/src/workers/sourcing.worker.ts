import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import pLimit from 'p-limit';
import { bullRedis } from '@/config/redis';
import { logger } from '@/config/logger';
import { Candidate } from '@/modules/candidates/candidate.model';
import { createSourcingProvider } from '@/modules/sourcing/providers/provider.factory';
import { mockProvider } from '@/modules/sourcing/providers/mock.provider';
import { duckduckgoProvider } from '@/modules/sourcing/providers/duckduckgo.provider';
import type { SourcingProvider } from '@/modules/sourcing/providers/provider.interface';
import { scoringQueue } from '@/queues';
import type { SourcingJobData } from '@/queues';
import {
    markProcessing,
    markCompleted,
    markFailed,
    createTask,
} from '@/modules/tasks/task.service';
import { sendTaskCompletedEmail, sendTaskFailedEmail } from '@/services/email.service';

export function startSourcingWorker(): Worker {
    const provider = createSourcingProvider();

    const worker = new Worker<SourcingJobData>(
        'sourcing',
        async (job: Job<SourcingJobData>) => {
            const { taskId, jobId, query, limit } = job.data;

            logger.info('SourcingWorker: started', {
                taskId,
                jobId,
                query,
                limit,
                provider: provider.name,
            });

            await markProcessing(taskId, job.id ?? '');
            await job.updateProgress(5);

            let rawCandidates;
            let resolvedProviderName = provider.name;

            // ── Provider chain: primary → DuckDuckGo (free) → Mock ─
            const providerChain: Array<{ p: SourcingProvider; label: string }> = [
                { p: provider, label: provider.name },
                { p: duckduckgoProvider, label: 'duckduckgo' },
                { p: mockProvider, label: 'mock' },
            ];

            // Skip DuckDuckGo if primary is already DuckDuckGo or Mock
            const chain = providerChain.filter(
                (entry, idx) => !(idx > 0 && provider.name === entry.label)
            );

            let lastError: unknown;
            let succeeded = false;

            for (const { p, label } of chain) {
                try {
                    rawCandidates = await p.search(query, limit);
                    resolvedProviderName = label;
                    succeeded = true;
                    if (label !== provider.name) {
                        logger.info('SourcingWorker: using fallback provider', {
                            failed: provider.name,
                            using: label,
                            taskId,
                        });
                    }
                    break;
                } catch (err) {
                    lastError = err;
                    logger.warn('SourcingWorker: provider failed, trying next', {
                        provider: label,
                        error: err instanceof Error ? err.message : String(err),
                        taskId,
                    });
                }
            }

            if (!succeeded || !rawCandidates) {
                const msg = lastError instanceof Error ? lastError.message : 'All providers failed';
                await markFailed(taskId, msg, job.attemptsMade);
                throw new Error(msg);
            }
            //───

            await job.updateProgress(40);
            logger.info('SourcingWorker: fetched candidates', { count: rawCandidates.length });

            const limit$ = pLimit(3);
            let added = 0;
            let skipped = 0;
            const newCandidateIds: string[] = [];

            await Promise.all(
                rawCandidates.map((raw: any) =>
                    limit$(async () => {
                        try {
                            const filter = {
                                jobId: new mongoose.Types.ObjectId(jobId),
                                linkedinUrl: raw.linkedinUrl,
                            };
                            const existing = await Candidate.findOne(filter).lean();
                            if (!existing) {
                                const result = await Candidate.create({
                                    ...raw,
                                    jobId: new mongoose.Types.ObjectId(jobId),
                                    source: resolvedProviderName,
                                    status: 'sourced',
                                });
                                added++;
                                newCandidateIds.push(result._id.toString());
                            } else {
                                skipped++;
                            }
                        } catch (err) {
                            logger.warn('SourcingWorker: failed to upsert candidate', {
                                linkedinUrl: raw.linkedinUrl,
                                error: err instanceof Error ? err.message : err,
                            });
                        }
                    })
                )
            );

            await job.updateProgress(80);
            logger.info('SourcingWorker: upserted candidates', { added, skipped });

            if (newCandidateIds.length > 0) {
                await Promise.all(
                    newCandidateIds.map(async candidateId => {
                        const scoreTask = await createTask({ type: 'scoring', jobId, candidateId });
                        const scoreTaskId = scoreTask._id.toString(); // Must be string for BullMQ
                        await scoringQueue.add(
                            'score-candidate',
                            { taskId: scoreTaskId, candidateId, jobId },
                            { jobId: scoreTaskId }
                        );
                    })
                );
                logger.info('SourcingWorker: enqueued scoring jobs', {
                    count: newCandidateIds.length,
                });
            }

            await markCompleted(taskId, {
                added,
                skipped,
                total: rawCandidates.length,
                provider: resolvedProviderName,
            });
            await job.updateProgress(100);

            await sendTaskCompletedEmail({
                taskType: 'sourcing',
                taskId,
                result: { added, skipped, total: rawCandidates.length, provider: provider.name },
            });

            return { added, skipped };
        },
        {
            connection: bullRedis,
            concurrency: 3,
        }
    );

    worker.on('failed', async (job, err) => {
        if (job) {
            logger.error('SourcingWorker: job failed', {
                jobId: job.id,
                taskId: job.data.taskId,
                error: err.message,
                attempts: job.attemptsMade,
            });
            if (job.attemptsMade >= 3) {
                await markFailed(job.data.taskId, err.message, job.attemptsMade);
                await sendTaskFailedEmail({
                    taskType: 'sourcing',
                    taskId: job.data.taskId,
                    error: err.message,
                    attempts: job.attemptsMade,
                });
            }
        }
    });

    logger.info('✅  SourcingWorker started', {
        primaryProvider: provider.name,
        fallbackChain: `${provider.name} → duckduckgo → mock`,
        concurrency: 3,
    });
    return worker;
}
