import type { ICandidateScore } from '@/types';

export interface IntentResult {
    intent: 'interested' | 'not_interested' | 'maybe';
    confidence: number;
    reason: string;
}

export interface IAiProvider {
    name: string;
    generateScoring(
        candidate: {
            name: string;
            headline: string;
            summary: string;
            skills: string[];
            experience: string;
            location: string;
        },
        job: { title: string; description: string; requirements: string[] }
    ): Promise<ICandidateScore>;

    generateOutreach(
        candidate: { name: string; headline: string; skills: string[]; experience: string },
        job: { title: string }
    ): Promise<string>;

    classifyIntent(message: string): Promise<IntentResult>;
}
