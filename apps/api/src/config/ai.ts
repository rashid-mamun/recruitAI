import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';

export const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? '',
});

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? '');

export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
    },
});

export const geminiJsonModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 1024,
    },
});
