import { Worker, Job as BullJob } from 'bullmq';
import OpenAI from 'openai';
import { bullRedis } from '@/config/redis';
import { env } from '@/config/env';
import { createNotification } from '@/modules/notifications/notification.service';
import { logger } from '@/config/logger';
import { geminiJsonModel, openai } from '@/config/ai';
import {
    markCompleted,
    markFailed,
    markProcessing,
    updateTask,
} from '@/modules/tasks/task.service';
import { Interview } from '@/modules/interviews/interview.model';
import { InterviewAnalysis } from '@/modules/interviews/interview-analysis.model';
import { TranscriptSegment } from '@/modules/interviews/transcript-segment.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Job } from '@/modules/jobs/job.model';
import { NotFoundError } from '@/middleware/errorHandler';
import type { InterviewAnalysisJobData } from '@/queues';
import type { IInterviewAnalysis } from '@/types';

let groqClient: OpenAI | null = null;
function getGroqClient() {
    if (!groqClient) {
        groqClient = new OpenAI({
            apiKey: env.GROQ_API_KEY ?? '',
            baseURL: 'https://api.groq.com/openai/v1',
        });
    }
    return groqClient;
}

export function startInterviewAnalysisWorker(): Worker {
    const worker = new Worker<InterviewAnalysisJobData>(
        'interview-analysis',
        async (job: BullJob<InterviewAnalysisJobData>) => {
            const { taskId, interviewId, candidateId, jobId } = job.data;
            logger.info('InterviewAnalysisWorker: started', { taskId, interviewId });

            await markProcessing(taskId, job.id ?? '');
            await job.updateProgress(10);

            const [interview, candidate, jobDoc, segments] = await Promise.all([
                Interview.findById(interviewId).lean(),
                Candidate.findById(candidateId).lean(),
                Job.findById(jobId).lean(),
                TranscriptSegment.find({ interviewId }).sort({ createdAt: 1 }).lean(),
            ]);

            if (!interview) throw new NotFoundError('Interview');
            if (!candidate) throw new NotFoundError('Candidate');
            if (!jobDoc) throw new NotFoundError('Job');

            const transcript =
                segments.length > 0
                    ? segments.map(s => `${s.speaker}: ${s.text}`).join('\n')
                    : ((interview as any).transcriptText ?? '');

            if (!transcript.trim() && !(interview as any).notes?.trim()) {
                throw new Error('Interview needs transcript text or notes before analysis');
            }

            await job.updateProgress(30);
            await updateTask(taskId, { progress: 30 });

            let analysisPayload: AnalysisPayload | null = null;
            let aiModel = 'local-rule-based';
            let source: 'ai' | 'fallback' = 'fallback';

            const prompt = buildAnalysisPrompt({
                job: jobDoc,
                candidate,
                interview,
                transcript,
            });

            if (env.GROQ_API_KEY) {
                try {
                    analysisPayload = await analyzeWithGroq(prompt);
                    aiModel = 'groq:llama-3.3-70b-versatile';
                    source = 'ai';
                } catch (err) {
                    logger.warn('InterviewAnalysisWorker: Groq failed, trying next provider', {
                        interviewId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }

            await job.updateProgress(55);
            await updateTask(taskId, { progress: 55 });

            if (!analysisPayload && env.GEMINI_API_KEY) {
                try {
                    analysisPayload = await analyzeWithGemini(prompt);
                    aiModel = 'gemini:gemini-2.5-flash';
                    source = 'ai';
                } catch (err) {
                    logger.warn('InterviewAnalysisWorker: Gemini failed, trying next provider', {
                        interviewId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }

            if (!analysisPayload && env.OPENAI_API_KEY) {
                try {
                    analysisPayload = await analyzeWithOpenAi(prompt);
                    aiModel = 'openai:gpt-4o-mini';
                    source = 'ai';
                } catch (err) {
                    logger.warn('InterviewAnalysisWorker: OpenAI failed, using local fallback', {
                        interviewId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }

            if (!analysisPayload) {
                analysisPayload = analyzeLocally(transcript || (interview as any).notes || '');
            }

            await job.updateProgress(80);
            await updateTask(taskId, { progress: 80 });

            const analysis = await InterviewAnalysis.findOneAndUpdate(
                { interviewId },
                {
                    $set: {
                        organizationId: (interview as any).organizationId,
                        interviewId,
                        candidateId,
                        jobId,
                        status: 'completed',
                        ...analysisPayload,
                        aiModel,
                        source,
                        error: null,
                    },
                },
                { new: true, upsert: true, runValidators: true }
            ).lean();

            await Interview.findByIdAndUpdate(interviewId, {
                $set: { status: 'analysis_ready', analysisId: (analysis as any)._id },
            });

            await markCompleted(taskId, {
                interviewId,
                analysisId: (analysis as any)._id.toString(),
                source,
                aiModel,
            });
            await job.updateProgress(100);

            await Promise.all(
                ((interview as any).interviewerIds ?? []).map((recipientUserId: string) =>
                    createNotification({
                        organizationId: (interview as any).organizationId.toString(),
                        recipientUserId,
                        type: 'analysis_ready',
                        message: `${(interview as any).title} analysis is ready`,
                        link: `/interviews/${interviewId}`,
                    })
                )
            );

            logger.info('InterviewAnalysisWorker: completed', { interviewId, source, aiModel });
            return analysis;
        },
        { connection: bullRedis, concurrency: 3 }
    );

    worker.on('failed', async (job, err) => {
        if (!job) return;
        const failedInterview = await Interview.findById(job.data.interviewId).lean();
        logger.error('InterviewAnalysisWorker: job failed', {
            taskId: job.data.taskId,
            interviewId: job.data.interviewId,
            error: err.message,
            attempts: job.attemptsMade,
        });

        await Promise.allSettled([
            markFailed(job.data.taskId, err.message, job.attemptsMade),
            Interview.findByIdAndUpdate(job.data.interviewId, { $set: { status: 'completed' } }),
            failedInterview
                ? InterviewAnalysis.findOneAndUpdate(
                      { interviewId: job.data.interviewId },
                      {
                          $set: {
                              organizationId: (failedInterview as any).organizationId,
                              interviewId: job.data.interviewId,
                              candidateId: job.data.candidateId,
                              jobId: job.data.jobId,
                              status: 'failed',
                              error: err.message,
                          },
                      },
                      { upsert: true }
                  )
                : Promise.resolve(),
        ]);
    });

    logger.info('✅  InterviewAnalysisWorker started', { concurrency: 3 });
    return worker;
}

interface AnalysisPayload {
    executiveSummary: string;
    technicalSignals: string[];
    behavioralSignals: string[];
    communicationSignals: string[];
    riskFlags: string[];
    evidence: Array<{ label: string; quote: string; speaker?: string }>;
    recommendation: IInterviewAnalysis['recommendation'];
    confidence: number;
}

function buildAnalysisPrompt({
    job,
    candidate,
    interview,
    transcript,
}: {
    job: any;
    candidate: any;
    interview: any;
    transcript: string;
}) {
    return `Analyze this hiring interview for structured recruiting decision support.

JOB:
Title: ${job.title}
Requirements: ${(job.requirements ?? []).join(', ')}
Description: ${(job.description ?? '').slice(0, 1200)}

CANDIDATE:
Name: ${candidate.name}
Headline: ${candidate.headline}
Skills: ${(candidate.skills ?? []).join(', ')}
Summary: ${(candidate.summary ?? '').slice(0, 800)}

INTERVIEW:
Title: ${interview.title}
Round: ${interview.round}
Type: ${interview.type}
Notes: ${(interview.notes ?? '').slice(0, 1200)}

TRANSCRIPT:
${transcript.slice(0, 18000)}

Return ONLY valid JSON:
{
  "executiveSummary": "3-5 sentence hiring summary grounded in evidence",
  "technicalSignals": ["signal"],
  "behavioralSignals": ["signal"],
  "communicationSignals": ["signal"],
  "riskFlags": ["risk or concern"],
  "evidence": [{"label":"competency or risk","quote":"short exact quote","speaker":"speaker name if known"}],
  "recommendation": "strong_yes" | "yes" | "maybe" | "no",
  "confidence": 0.0
}`.trim();
}

async function analyzeWithGroq(prompt: string): Promise<AnalysisPayload> {
    const response = await getGroqClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            {
                role: 'system',
                content:
                    'You are an expert hiring interview analyst. Return strict JSON only, no markdown.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1400,
    });
    return parseAnalysisPayload(response.choices[0]?.message?.content);
}

async function analyzeWithOpenAi(prompt: string): Promise<AnalysisPayload> {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: 'You are an expert hiring interview analyst. Return strict JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1400,
    });
    return parseAnalysisPayload(response.choices[0]?.message?.content);
}

async function analyzeWithGemini(prompt: string): Promise<AnalysisPayload> {
    const result = await geminiJsonModel.generateContent(prompt);
    return parseAnalysisPayload(result.response.text());
}

function parseAnalysisPayload(raw?: string | null): AnalysisPayload {
    if (!raw) throw new Error('AI returned empty interview analysis');
    const clean = raw
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/```/g, '')
        .trim();
    const parsed = JSON.parse(clean);
    return normalizePayload(parsed);
}

function normalizePayload(parsed: any): AnalysisPayload {
    const recommendation = ['strong_yes', 'yes', 'maybe', 'no'].includes(parsed.recommendation)
        ? parsed.recommendation
        : 'maybe';

    return {
        executiveSummary: String(parsed.executiveSummary ?? 'Interview analyzed.'),
        technicalSignals: normalizeStringArray(parsed.technicalSignals),
        behavioralSignals: normalizeStringArray(parsed.behavioralSignals),
        communicationSignals: normalizeStringArray(parsed.communicationSignals),
        riskFlags: normalizeStringArray(parsed.riskFlags),
        evidence: Array.isArray(parsed.evidence)
            ? parsed.evidence.slice(0, 8).map((item: any) => ({
                  label: String(item.label ?? 'Evidence'),
                  quote: String(item.quote ?? '').slice(0, 500),
                  speaker: item.speaker ? String(item.speaker) : '',
              }))
            : [],
        recommendation,
        confidence: clampNumber(Number(parsed.confidence ?? 0.5), 0, 1),
    };
}

function analyzeLocally(text: string): AnalysisPayload {
    const lower = text.toLowerCase();
    const technicalSignals = pickSignals(lower, [
        ['architecture', 'Discussed architecture or design considerations.'],
        ['api', 'Mentioned API design or integration work.'],
        ['database', 'Discussed database-related experience.'],
        ['typescript', 'Mentioned TypeScript experience.'],
        ['react', 'Mentioned frontend/React experience.'],
        ['node', 'Mentioned Node.js/backend experience.'],
    ]);

    const behavioralSignals = pickSignals(lower, [
        ['team', 'Referenced team collaboration.'],
        ['mentor', 'Referenced mentoring or supporting others.'],
        ['ownership', 'Referenced ownership.'],
        ['conflict', 'Discussed conflict or tradeoff handling.'],
    ]);

    const communicationSignals =
        text.length > 1200
            ? ['Provided enough detail for an initial communication assessment.']
            : ['Transcript is short; communication confidence is limited.'];

    const riskFlags = [];
    if (text.length < 800) riskFlags.push('Transcript is short; analysis confidence is limited.');
    if (!technicalSignals.length) riskFlags.push('Few explicit technical signals found.');

    const signalCount = technicalSignals.length + behavioralSignals.length;
    const recommendation = signalCount >= 5 ? 'yes' : signalCount >= 3 ? 'maybe' : ('no' as const);

    const firstEvidence = text
        .split(/\n+/)
        .map(line => line.trim())
        .find(line => line.length > 40);

    return {
        executiveSummary:
            signalCount > 0
                ? `Local analysis found ${signalCount} useful interview signals. Review the transcript evidence before making a final hiring decision.`
                : 'Local analysis found limited structured evidence. Add a richer transcript or use a configured AI provider for deeper analysis.',
        technicalSignals,
        behavioralSignals,
        communicationSignals,
        riskFlags,
        evidence: firstEvidence
            ? [{ label: 'Transcript evidence', quote: firstEvidence.slice(0, 400) }]
            : [],
        recommendation,
        confidence: text.length > 1600 ? 0.55 : 0.35,
    };
}

function pickSignals(lowerText: string, rules: Array<[string, string]>): string[] {
    return rules.filter(([keyword]) => lowerText.includes(keyword)).map(([, signal]) => signal);
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => String(item ?? '').trim())
        .filter(Boolean)
        .slice(0, 10);
}

function clampNumber(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
}
