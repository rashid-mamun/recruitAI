import { Worker, Job } from 'bullmq';
import { bullRedis } from '@/config/redis';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { AiFactory } from '@/services/ai/ai.factory';
import { groqProvider } from '@/services/ai/providers/groq.provider';
import { smartAiRetry } from '@/utils/smartRetry';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Job as JobModel } from '@/modules/jobs/job.model';
import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from '@/config/redis';
import { markProcessing, markCompleted, markFailed } from '@/modules/tasks/task.service';
import { sendTaskCompletedEmail, sendTaskFailedEmail } from '@/services/email.service';
import { NotFoundError } from '@/middleware/errorHandler';
import type { ScoringJobData } from '@/queues';
import type { ICandidateScore } from '@/types';
import pRetry from 'p-retry';

export function startScoringWorker(): Worker {
    const worker = new Worker<ScoringJobData>(
        'scoring',
        async (job: Job<ScoringJobData>) => {
            const { taskId, candidateId, jobId, forceRefresh } = job.data;

            logger.info('ScoringWorker: started', { taskId, candidateId, jobId });
            await markProcessing(taskId, job.id ?? '');
            await job.updateProgress(10);

            const cacheKey = CacheKeys.score(candidateId, jobId);
            if (!forceRefresh) {
                const cached = await cacheGet<ICandidateScore>(cacheKey);
                if (cached) {
                    if (cached.source === 'fallback') {
                        logger.info(
                            'ScoringWorker: stale fallback cache hit — deleting and re-scoring',
                            {
                                candidateId,
                            }
                        );
                        await cacheDel(cacheKey);
                    } else {
                        logger.info('ScoringWorker: cache hit — skipping AI call', { candidateId });
                        await markCompleted(taskId, { score: cached, fromCache: true });
                        await job.updateProgress(100);
                        return cached;
                    }
                }
            }

            await job.updateProgress(20);

            const [candidate, jobDoc] = await Promise.all([
                Candidate.findById(candidateId).lean(),
                JobModel.findById(jobId).lean(),
            ]);

            if (!candidate) throw new NotFoundError('Candidate');
            if (!jobDoc) throw new NotFoundError('Job');

            await job.updateProgress(30);

            let scoreObj: ICandidateScore;
            let aiSource = 'ai';

            const hasAnyAiKey = !!(env.GEMINI_API_KEY || env.OPENAI_API_KEY);
            const hasGroqKey = !!env.GROQ_API_KEY;

            if (!hasAnyAiKey && !hasGroqKey) {
                // ── No AI keys at all → rule-based immediately ─────
                logger.info('ScoringWorker: no AI keys — using rule-based scoring', {
                    candidateId,
                });
                aiSource = 'fallback';
                const raw = calculateFallbackScore(candidate, jobDoc);
                scoreObj = {
                    value: Math.max(0, Math.min(100, Math.round(raw.score))),
                    reasoning: raw.reasoning,
                    strengths: raw.strengths ?? [],
                    weaknesses: raw.weaknesses ?? [],
                    cachedAt: new Date(),
                    source: 'fallback',
                };
            } else {
                // ── AI chain: primary (Gemini/OpenAI) → Groq (free) → rule-based ─
                let aiResult: ICandidateScore | null = null;

                // Step 1 — primary provider
                if (hasAnyAiKey) {
                    try {
                        const primary = AiFactory.getProvider();
                        aiResult = await smartAiRetry(
                            () => primary.generateScoring(candidate, jobDoc),
                            'candidate-scoring'
                        );
                        logger.info('ScoringWorker: scored via primary AI', {
                            candidateId,
                            provider: primary.name,
                        });
                    } catch (err) {
                        logger.warn('ScoringWorker: primary AI failed, trying Groq', {
                            candidateId,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    }
                }

                // Step 2 — Groq fallback (free)
                if (!aiResult && hasGroqKey) {
                    try {
                        aiResult = await smartAiRetry(
                            () => groqProvider.generateScoring(candidate, jobDoc),
                            'candidate-scoring-groq'
                        );
                        logger.info('ScoringWorker: scored via Groq (free fallback)', {
                            candidateId,
                        });
                    } catch (err) {
                        logger.warn('ScoringWorker: Groq also failed, using rule-based', {
                            candidateId,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    }
                }

                // Step 3 — rule-based fallback
                if (!aiResult) {
                    aiSource = 'fallback';
                    const raw = calculateFallbackScore(candidate, jobDoc);
                    scoreObj = {
                        value: Math.max(0, Math.min(100, Math.round(raw.score))),
                        reasoning: raw.reasoning,
                        strengths: raw.strengths ?? [],
                        weaknesses: raw.weaknesses ?? [],
                        cachedAt: new Date(),
                        source: 'fallback',
                    };
                } else {
                    scoreObj = { ...aiResult, cachedAt: new Date(), source: 'ai' };
                }
            }

            await job.updateProgress(80);

            await Candidate.findByIdAndUpdate(candidateId, {
                $set: { score: scoreObj, status: 'scored', scoredAt: new Date() },
            });

            await cacheSet(
                cacheKey,
                scoreObj,
                aiSource === 'fallback' ? CacheTTL.SCORE_FALLBACK : CacheTTL.SCORE
            );

            await markCompleted(taskId, { score: scoreObj, fromCache: false });
            await job.updateProgress(100);

            await sendTaskCompletedEmail({
                taskType: 'scoring',
                taskId,
                result: { candidateId, score: scoreObj.value, fromCache: false },
            });

            logger.info('ScoringWorker: completed', { candidateId, score: scoreObj.value });
            return scoreObj;
        },
        { connection: bullRedis, concurrency: 5 }
    );

    worker.on('failed', async (job, err) => {
        if (job) {
            logger.error('ScoringWorker: job failed', {
                taskId: job.data.taskId,
                error: err.message,
                attempts: job.attemptsMade,
            });
            if (job.attemptsMade >= 3) {
                await markFailed(job.data.taskId, err.message, job.attemptsMade);
                await sendTaskFailedEmail({
                    taskType: 'scoring',
                    taskId: job.data.taskId,
                    error: err.message,
                    attempts: job.attemptsMade,
                });
            }
        }
    });

    logger.info('✅  ScoringWorker started', { concurrency: 5 });
    return worker;
}

function calculateFallbackScore(
    candidate: {
        name: string;
        headline: string;
        summary: string;
        skills: string[];
        experience: string;
        location: string;
    },
    job: { title: string; description: string; requirements: string[]; location: string }
): {
    score: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
} {
    let score = 40;
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    const candidateSkills = (candidate.skills || []).map(skill => skill.toLowerCase());
    const jobRequirements = (job.requirements || []).map(requirement => requirement.toLowerCase());

    const matchedSkills = jobRequirements.filter(requirement =>
        candidateSkills.some(skill => skill.includes(requirement) || requirement.includes(skill))
    );

    if (matchedSkills.length > 0) {
        score += Math.min(matchedSkills.length * 8, 30);
        strengths.push(`Matches ${matchedSkills.length}/${jobRequirements.length} required skills`);
    } else {
        weaknesses.push('No direct skill matches found');
    }

    const headlineWords = candidate.headline.toLowerCase().split(/\s+/);
    const jobWords = job.title.toLowerCase().split(/\s+/);
    const titleOverlap = jobWords.filter(
        word =>
            word.length > 2 &&
            headlineWords.some(
                headlineWord => headlineWord.includes(word) || word.includes(headlineWord)
            )
    );

    if (titleOverlap.length > 0) {
        score += Math.min(titleOverlap.length * 7, 15);
        strengths.push('Job title aligns with candidate headline');
    }

    const yearsMatch = candidate.experience?.match(/(\d+)/);
    if (yearsMatch) {
        const years = Number.parseInt(yearsMatch[1], 10);
        if (years >= 5) {
            score += 10;
            strengths.push('5+ years experience');
        } else if (years >= 3) {
            score += 6;
            strengths.push('3+ years experience');
        } else if (years >= 1) {
            score += 3;
            strengths.push('1+ years experience');
        }
    }

    if (candidate.location && job.location) {
        const locationMatch =
            candidate.location.toLowerCase().includes(job.location.toLowerCase()) ||
            job.location.toLowerCase().includes('remote') ||
            candidate.location.toLowerCase().includes('remote');

        if (locationMatch) {
            score += 5;
            strengths.push('Location match');
        }
    }

    return {
        score: Math.min(Math.max(score, 0), 100),
        reasoning: `[Rule-based] ${strengths.join('. ') || weaknesses.join('. ') || 'Basic profile evaluated'}.`,
        strengths,
        weaknesses,
    };
}
