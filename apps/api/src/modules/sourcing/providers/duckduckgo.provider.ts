/**
 * DuckDuckGo Sourcing Provider
 * Free alternative to Serper — searches LinkedIn profiles via DuckDuckGo HTML.
 * No API key required.
 */
import axios from 'axios';
import pRetry from 'p-retry';
import type { SourcingProvider, RawCandidate } from './provider.interface';
import { logger } from '@/config/logger';

const DDG_URL = 'https://html.duckduckgo.com/html/';

const TECH_KEYWORDS = [
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
    'Rust',
    'Swift',
];

function extractSkills(text: string): string[] {
    return TECH_KEYWORDS.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
}

function extractExperience(text: string): string {
    const match = text.match(/(\d+)\+?\s*years?/i);
    return match ? `${match[1]} years` : '';
}

function extractLocation(text: string): string {
    const match = text.match(/(?:in|at|from)\s+([A-Za-z\s,]+?)(?:\.|,|\s{2}|$)/i);
    return match ? match[1].trim() : '';
}

/**
 * Parse raw HTML from DuckDuckGo and extract LinkedIn results.
 * DDG HTML results have anchors with class "result__a" and snippets with "result__snippet".
 */
function parseHtml(html: string, limit: number): RawCandidate[] {
    const candidates: RawCandidate[] = [];

    // Match result blocks: <a class="result__a" href="...">TITLE</a> ... <a class="result__snippet">SNIPPET</a>
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const links: Array<{ url: string; title: string }> = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && links.length < limit * 3) {
        const url = decodeURIComponent(
            m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]
        );
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        if (url.includes('linkedin.com/in/')) {
            links.push({ url, title });
        }
    }

    const snippets: string[] = [];
    while ((s = snippetRegex.exec(html)) !== null) {
        snippets.push(s[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < Math.min(links.length, limit); i++) {
        const { url, title } = links[i];
        const snippet = snippets[i] ?? '';

        const titleParts = title.replace(/\s*\|\s*LinkedIn.*$/, '').split('-');
        const name = titleParts[0]?.trim() || 'Unknown';
        const headline = titleParts.slice(1).join('-').trim() || snippet.split('.')[0] || '';

        candidates.push({
            name,
            linkedinUrl: url,
            headline,
            summary: snippet,
            skills: extractSkills(snippet),
            experience: extractExperience(snippet),
            location: extractLocation(snippet),
        });
    }

    return candidates;
}

// Fix TS complaint about undeclared s variable
let s: RegExpExecArray | null;

export const duckduckgoProvider: SourcingProvider = {
    name: 'duckduckgo',

    search: async (query: string, limit: number): Promise<RawCandidate[]> => {
        const searchQuery = `site:linkedin.com/in ${query}`;
        logger.debug('DuckDuckGoProvider searching', { query: searchQuery, limit });

        const html = await pRetry(
            async () => {
                const { data } = await axios.post(
                    DDG_URL,
                    new URLSearchParams({ q: searchQuery, b: '' }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent':
                                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                            Accept: 'text/html',
                        },
                        timeout: 12_000,
                    }
                );
                if (typeof data !== 'string' || data.length < 500) {
                    throw new Error('DuckDuckGo returned unexpected response');
                }
                return data as string;
            },
            {
                retries: 2,
                minTimeout: 2000,
                onFailedAttempt: err => {
                    logger.warn('DuckDuckGoProvider attempt failed', {
                        attempt: err.attemptNumber,
                        error: err.message,
                    });
                },
            }
        );

        const results = parseHtml(html, limit);
        logger.debug('DuckDuckGoProvider parsed results', { count: results.length });

        if (results.length === 0) {
            throw new Error('DuckDuckGo returned 0 LinkedIn profiles — may be blocked');
        }

        return results;
    },
};
