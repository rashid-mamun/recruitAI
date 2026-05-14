import { Worker, Job } from 'bullmq';
import { bullRedis } from '@/config/redis';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { AiFactory } from '@/services/ai/ai.factory';
import { groqProvider } from '@/services/ai/providers/groq.provider';
import { smartAiRetry } from '@/utils/smartRetry';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Job as JobModel } from '@/modules/jobs/job.model';
import { Message } from '@/modules/candidates/message.model';
import { markProcessing, markCompleted, markFailed } from '@/modules/tasks/task.service';
import { sendTaskCompletedEmail, sendTaskFailedEmail } from '@/services/email.service';
import { NotFoundError } from '@/middleware/errorHandler';
import type { OutreachJobData } from '@/queues';
import pRetry from 'p-retry';

export function startOutreachWorker(): Worker {
    const worker = new Worker<OutreachJobData>(
        'outreach',
        async (job: Job<OutreachJobData>) => {
            const { taskId, candidateId, jobId } = job.data;

            logger.info('OutreachWorker: started', { taskId, candidateId, jobId });
            await markProcessing(taskId, job.id ?? '');
            await job.updateProgress(10);

            const [candidate, jobDoc] = await Promise.all([
                Candidate.findById(candidateId).lean(),
                JobModel.findById(jobId).lean(),
            ]);

            if (!candidate) throw new NotFoundError('Candidate');
            if (!jobDoc) throw new NotFoundError('Job');

            await job.updateProgress(20);

            let messageContent: string | null = null;
            let usedFallback = false;

            const hasAnyAiKey = !!(env.GEMINI_API_KEY || env.OPENAI_API_KEY);
            const hasGroqKey = !!env.GROQ_API_KEY;

            // ── AI chain: primary → Groq (free) → template ──────────

            // Step 1 — primary Gemini/OpenAI
            if (hasAnyAiKey) {
                try {
                    const primary = AiFactory.getProvider();
                    messageContent = await smartAiRetry(
                        () => primary.generateOutreach(candidate, jobDoc),
                        'outreach-generation'
                    );
                    logger.info('OutreachWorker: message via primary AI', {
                        candidateId,
                        provider: primary.name,
                    });
                } catch (err) {
                    logger.warn('OutreachWorker: primary AI failed, trying Groq', {
                        candidateId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }

            // Step 2 — Groq fallback (free tier)
            if (!messageContent && hasGroqKey) {
                try {
                    messageContent = await smartAiRetry(
                        () => groqProvider.generateOutreach(candidate, jobDoc),
                        'outreach-generation-groq'
                    );
                    logger.info('OutreachWorker: message via Groq (free fallback)', {
                        candidateId,
                    });
                } catch (err) {
                    logger.warn('OutreachWorker: Groq also failed, using template', {
                        candidateId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }

            // Step 3 — template fallback
            if (!messageContent) {
                usedFallback = true;
                logger.info('OutreachWorker: using template outreach', { candidateId });
                messageContent = buildFallbackMessage(candidate, jobDoc);
            }
            //

            await job.updateProgress(60);
            logger.info('OutreachWorker: generated message', {
                candidateId,
                length: messageContent.length,
            });

            const message = await Message.create({
                candidateId,
                jobId,
                content: messageContent,
                channel: 'linkedin',
                source: usedFallback ? 'fallback' : 'ai',
                status: 'pending',
            });

            await job.updateProgress(75);

            await message.updateOne({ status: 'sent', sentAt: new Date() });

            await Candidate.findByIdAndUpdate(candidateId, {
                $set: { status: 'contacted', contactedAt: new Date() },
                $push: { outreachMessages: message._id },
            });

            await job.updateProgress(95);

            await markCompleted(taskId, {
                messageId: message._id.toString(),
                channel: 'linkedin',
                source: usedFallback ? 'fallback' : 'ai',
                sentAt: new Date().toISOString(),
            });

            await job.updateProgress(100);

            await sendTaskCompletedEmail({
                taskType: 'outreach',
                taskId,
                result: {
                    candidateId,
                    messageId: message._id.toString(),
                    channel: 'linkedin',
                    source: usedFallback ? 'fallback' : 'ai',
                },
            });

            logger.info('OutreachWorker: completed', { candidateId, messageId: message._id });
            return { messageId: message._id.toString() };
        },
        { connection: bullRedis, concurrency: 2 }
    );

    worker.on('failed', async (job, err) => {
        if (job) {
            logger.error('OutreachWorker: job failed', {
                taskId: job.data.taskId,
                error: err.message,
                attempts: job.attemptsMade,
            });
            if (job.attemptsMade >= 3) {
                await markFailed(job.data.taskId, err.message, job.attemptsMade);
                await sendTaskFailedEmail({
                    taskType: 'outreach',
                    taskId: job.data.taskId,
                    error: err.message,
                    attempts: job.attemptsMade,
                });
            }
        }
    });

    logger.info('✅  OutreachWorker started', { concurrency: 2 });
    return worker;
}

function buildFallbackMessage(
    candidate: { name: string; headline: string; skills: string[]; experience: string },
    job: { title: string; location?: string; employmentType?: string }
): string {
    const firstName = candidate.name.split(' ')[0];
    const topSkills = (candidate.skills || []).slice(0, 3);
    const hasSkills = topSkills.length > 0;
    const isRemote = job.location?.toLowerCase().includes('remote');

    const openings = [
        `I came across your profile and was genuinely impressed by your background as ${candidate.headline}.`,
        `Your experience as ${candidate.headline} caught my attention while I was searching for strong candidates.`,
        `I've been looking for someone with your background in ${candidate.headline}, and your profile stood out.`,
    ];
    const opening = openings[candidate.name.length % openings.length];

    const skillsSentence = hasSkills
        ? `Your expertise in ${topSkills.join(', ')} is a strong match for what we need.`
        : `Your experience aligns well with what we're looking for in this role.`;

    const locationSentence = isRemote
        ? `The position is fully remote, so there's no relocation required.`
        : `The role is based in ${job.location}, offering a ${job.employmentType || 'full-time'} position.`;

    const yearsMatch = candidate.experience?.match(/(\d+)/);
    const years = yearsMatch ? Number.parseInt(yearsMatch[1], 10) : 0;
    const cta =
        years >= 5
            ? `I'd love to have a quick 20-minute call to share more details and hear about your career goals. Would you be open to connecting this week?`
            : `I'd be happy to share more about the opportunity and answer any questions. Would you have 15 minutes for a quick call?`;

    return `Hi ${firstName},\n\n${opening} We're currently hiring for a ${job.title} position and I think you could be a great fit.\n\n${skillsSentence} ${locationSentence}\n\n${cta}\n\nLooking forward to hearing from you.\n\nBest regards,\nThe Recruiting Team`;
}
