import { env } from '@/config/env';
import type { SourcingProvider } from './provider.interface';
import { mockProvider } from './mock.provider';
import { serperProvider } from './serper.provider';
import { puppeteerProvider } from './puppeteer.provider';

export function createSourcingProvider(): SourcingProvider {
    switch (env.SOURCING_PROVIDER) {
        case 'serper':
            return serperProvider;
        case 'puppeteer':
            return puppeteerProvider;
        case 'mock':
        default:
            return mockProvider;
    }
}
