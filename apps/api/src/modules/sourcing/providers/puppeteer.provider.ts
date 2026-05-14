import puppeteer from 'puppeteer';
import { SourcingProvider } from '@/types';

import type { SourcingProvider as ISourcingProvider } from './provider.interface';

export const puppeteerProvider: ISourcingProvider = {
    name: 'puppeteer',

    async search(query: string, limit: number = 10): Promise<any[]> {
        const rawCandidates: any[] = [];

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
            ],
        });

        try {
            const page = await browser.newPage();

            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            const searchQuery = `site:linkedin.com/in/ ${query}`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
                waitUntil: 'domcontentloaded',
            });

            const results = await page.evaluate(maxResults => {
                const parsed: any[] = [];
                const items = (globalThis as any).document.querySelectorAll('div.g');

                for (const item of items) {
                    if (parsed.length >= maxResults) break;

                    const anchor = item.querySelector('a');
                    const titleEl = item.querySelector('h3');
                    const snippetEl = item.querySelector('.VwiC3b');

                    if (anchor && titleEl) {
                        const url = anchor.href;
                        if (url.includes('linkedin.com/in/')) {
                            const fullTitle = titleEl.textContent || '';
                            const parts = fullTitle.split('-');
                            const name = parts[0]?.trim() || 'Unknown Candidate';
                            const headline = parts[1]?.trim() || '';

                            parsed.push({
                                url,
                                name,
                                headline,
                                snippet: snippetEl ? snippetEl.textContent : '',
                            });
                        }
                    }
                }
                return parsed;
            }, limit);

            for (const res of results) {
                rawCandidates.push({
                    provider: 'puppeteer',
                    externalId: res.url.split('linkedin.com/in/')[1]?.replace(/\/$/, '') || res.url,
                    data: {
                        name: res.name,
                        headline: res.headline,
                        linkedinUrl: res.url,
                        rawSnippet: res.snippet,
                    },
                });
            }
        } catch (error) {
            console.error('[PuppeteerProvider] Failed to scrape:', error);
        } finally {
            await browser.close();
        }

        return rawCandidates;
    },
};
