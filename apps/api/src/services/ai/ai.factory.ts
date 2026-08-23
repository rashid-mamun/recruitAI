import { env } from '@/config/env';
import { logger } from '@/config/logger';
import type { IAiProvider } from './ai.interface';
import { openaiProvider } from './providers/openai.provider';
import { geminiProvider } from './providers/gemini.provider';
import { groqProvider } from './providers/groq.provider';

export class AiFactory {
    static getProvider(): IAiProvider {
        const providerName = env.ACTIVE_AI_PROVIDER?.toLowerCase();

        if (providerName === 'openai') {
            if (!env.OPENAI_API_KEY) {
                logger.warn(
                    'OpenAI selected but no API key found. Falling back to free-first provider order.'
                );
            } else {
                return openaiProvider;
            }
        }

        if (providerName === 'groq') {
            if (!env.GROQ_API_KEY) {
                logger.warn('Groq selected but no API key found. Falling back if possible.');
            } else {
                return groqProvider;
            }
        }

        if (providerName === 'gemini') {
            if (!env.GEMINI_API_KEY) {
                logger.warn('Gemini selected but no API key found. Falling back if possible.');
            } else {
                return geminiProvider;
            }
        }

        if (env.GROQ_API_KEY) return groqProvider;
        if (env.GEMINI_API_KEY) return geminiProvider;
        if (env.OPENAI_API_KEY) return openaiProvider;

        logger.warn('No AI provider key configured. Callers should use local fallback.');
        return groqProvider;
    }
}
