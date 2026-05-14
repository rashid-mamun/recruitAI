import OpenAI from 'openai';
import { env } from '@/config/env';
import type { IAiProvider, IntentResult } from '../ai.interface';
import type { ICandidateScore } from '@/types';

// Lazy-init so we don't crash on startup if key is missing
let _groqClient: OpenAI | null = null;
function getGroqClient(): OpenAI {
    if (!_groqClient) {
        _groqClient = new OpenAI({
            apiKey: env.GROQ_API_KEY ?? '',
            baseURL: 'https://api.groq.com/openai/v1',
        });
    }
    return _groqClient;
}

const MODEL = 'llama-3.3-70b-versatile';

function buildScoringPrompt(
    candidate: {
        name: string;
        headline: string;
        summary: string;
        skills: string[];
        experience: string;
        location: string;
    },
    job: { title: string; description: string; requirements: string[] }
): string {
    return `Evaluate this candidate against the job requirements and return a JSON object.

JOB TITLE: ${job.title}
JOB REQUIREMENTS: ${job.requirements.join(', ')}
JOB DESCRIPTION: ${job.description.slice(0, 500)}

CANDIDATE:
Name: ${candidate.name}
Headline: ${candidate.headline}
Summary: ${candidate.summary.slice(0, 400)}
Skills: ${candidate.skills.join(', ')}
Experience: ${candidate.experience}
Location: ${candidate.location}

Return ONLY this JSON (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "reasoning": "<2-3 sentences explaining the score>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<gap 1>", "<gap 2>"]
}`.trim();
}

function buildOutreachPrompt(
    candidate: { name: string; headline: string; skills: string[]; experience: string },
    job: { title: string }
): string {
    return `Write a personalized LinkedIn outreach message for a recruiting campaign.

Candidate: ${candidate.name}
Their Role/Headline: ${candidate.headline}
Their Top Skills: ${candidate.skills.slice(0, 5).join(', ')}
Their Experience: ${candidate.experience}
Job We're Hiring For: ${job.title}

Guidelines:
- Address them by first name only
- Warm and conversational tone (NOT corporate or robotic)
- Reference something specific about their background or skills
- Mention the role briefly but don't oversell
- End with a low-pressure call to action (e.g. "Would you be open to a quick chat?")
- Keep it under 150 words
- Do NOT start with "I came across your profile" or "I hope this message finds you well"
- Do NOT use emojis

Write ONLY the message text, no subject line, no signature.`.trim();
}

export const groqProvider: IAiProvider = {
    name: 'groq',

    async generateScoring(candidate, job): Promise<ICandidateScore> {
        const groq = getGroqClient();
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert technical recruiter. Evaluate candidates objectively. Always respond with valid JSON matching the requested schema exactly. No markdown.',
                },
                { role: 'user', content: buildScoringPrompt(candidate, job) },
            ],
            temperature: 0.3,
            max_tokens: 800,
        });

        const raw = response.choices[0]?.message?.content?.trim();
        if (!raw) throw new Error('Groq returned empty response for scoring');

        // Strip possible markdown fences
        const clean = raw
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        const parsed = JSON.parse(clean);

        if (typeof parsed.score !== 'number') {
            throw new Error('Invalid score format from Groq');
        }

        return {
            value: Math.max(0, Math.min(100, Math.round(parsed.score))),
            reasoning: parsed.reasoning ?? '',
            strengths: parsed.strengths ?? [],
            weaknesses: parsed.weaknesses ?? [],
            cachedAt: new Date(),
            source: 'ai',
        };
    },

    async generateOutreach(candidate, job): Promise<string> {
        const groq = getGroqClient();
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert technical recruiter writing LinkedIn outreach messages.',
                },
                { role: 'user', content: buildOutreachPrompt(candidate, job) },
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        const text = response.choices[0]?.message?.content?.trim();
        if (!text || text.length < 20) {
            throw new Error('Groq returned empty outreach message');
        }
        return text;
    },

    async classifyIntent(message: string): Promise<IntentResult> {
        const groq = getGroqClient();
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'Classify candidate intent from their reply to a job outreach message. Respond ONLY with valid JSON, no markdown.',
                },
                {
                    role: 'user',
                    content: `Classify the intent of this candidate's reply to a job outreach message.
Message: "${message}"

Respond with ONLY valid JSON, no markdown, no explanation:
{"intent":"interested"|"not_interested"|"maybe","confidence":0.0-1.0,"reason":"one sentence"}`,
                },
            ],
            temperature: 0.1,
            max_tokens: 150,
        });

        const raw = response.choices[0]?.message?.content?.trim();
        if (!raw) throw new Error('Groq returned empty response for intent');

        const clean = raw
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        return JSON.parse(clean) as IntentResult;
    },
};
