import axios from 'axios';
import pRetry from 'p-retry';
import type { SourcingProvider, RawCandidate } from './provider.interface';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

interface SerperSearchResult {
    organic: Array<{
        title: string;
        link: string;
        snippet: string;
        position: number;
    }>;
}

const apiUrl = 'https://google.serper.dev/search';

const extractSkills = (text: string): string[] => {
    const techKeywords = [
        'JavaScript',
        'TypeScript',
        'Node.js',
        'React',
        'MongoDB',
        'Express',
        'Python',
        'AWS',
        'Docker',
        'Redis',
        'GraphQL',
        'PostgreSQL',
        'MySQL',
        'Kubernetes',
        'Go',
        'Java',
        'Next.js',
        'Vue',
        'Angular',
    ];
    return techKeywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
};

const extractExperience = (text: string): string => {
    const match = text.match(/(\d+)\+?\s*years?/i);
    return match ? `${match[1]} years` : '';
};

const extractLocation = (text: string): string => {
    const match = text.match(/(?:in|at|from)\s+([A-Za-z\s,]+?)(?:\.|,|\s{2}|$)/i);
    return match ? match[1].trim() : '';
};

const parseResults = (organic: SerperSearchResult['organic'], limit: number): RawCandidate[] => {
    const candidates: RawCandidate[] = [];

    for (const result of organic.slice(0, limit)) {
        if (!result.link.includes('linkedin.com/in/')) continue;

        const titleParts = result.title.replace(/\s*\|\s*LinkedIn.*$/, '').split('-');
        const name = titleParts[0]?.trim() ?? 'Unknown';
        const headline =
            titleParts.slice(1).join('-').trim() || (result.snippet?.split('.')[0] ?? '');

        const skills = extractSkills(result.snippet ?? '');

        candidates.push({
            name,
            linkedinUrl: result.link,
            headline,
            summary: result.snippet ?? '',
            skills,
            experience: extractExperience(result.snippet ?? ''),
            location: extractLocation(result.snippet ?? ''),
        });
    }

    return candidates;
};

export const serperProvider: SourcingProvider = {
    name: 'serper',
    search: async (query: string, limit: number): Promise<RawCandidate[]> => {
        const searchQuery = `site:linkedin.com/in ${query}`;

        logger.debug('SerperProvider searching', { query: searchQuery, limit });

        const results = await pRetry(
            async () => {
                const { data } = await axios.post<SerperSearchResult>(
                    apiUrl,
                    { q: searchQuery, num: Math.min(limit, 10) },
                    {
                        headers: {
                            'X-API-KEY': env.SERPER_API_KEY ?? '',
                            'Content-Type': 'application/json',
                        },
                        timeout: 10_000,
                    }
                );
                return data;
            },
            {
                retries: 3,
                factor: 2,
                minTimeout: 1000,
                onFailedAttempt: error => {
                    logger.warn('Serper API attempt failed', {
                        attempt: error.attemptNumber,
                        error: error.message,
                    });
                },
            }
        );

        return parseResults(results.organic ?? [], limit);
    },
};
