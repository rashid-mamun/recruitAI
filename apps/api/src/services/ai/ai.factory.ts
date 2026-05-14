import { env } from '@/config/env';
import { logger } from '@/config/logger';
import type { IAiProvider } from './ai.interface';
import { openaiProvider } from './providers/openai.provider';
import { geminiProvider } from './providers/gemini.provider';

export class AiFactory {
    static getProvider(): IAiProvider {
        const providerName = env.ACTIVE_AI_PROVIDER || 'gemini';

        if (providerName.toLowerCase() === 'openai') {
            if (!env.OPENAI_API_KEY) {
                logger.warn(
                    'OpenAI selected but no API key found, falling back to Gemini (if available) or it will fail.'
                );
            }
            return openaiProvider;
        }

        if (!env.GEMINI_API_KEY) {
            logger.warn('Gemini selected but no API key found.');
        }
        return geminiProvider;
    }
}
