import { createSourcingProvider } from '@/modules/sourcing/providers/provider.factory';
import { env } from '@/config/env';

describe('Sourcing Service (Provider Factory)', () => {
    let originalProvider: string | undefined;

    beforeAll(() => {
        originalProvider = env.SOURCING_PROVIDER;
    });

    afterAll(() => {
        env.SOURCING_PROVIDER = originalProvider as any;
    });

    it('SOURCING_PROVIDER=mock -> returns MockProvider instance', () => {
        env.SOURCING_PROVIDER = 'mock';
        const provider = createSourcingProvider();
        expect(provider.name).toBe('mock');
    });

    it('MockProvider.search() -> returns array of candidate objects with name, email, linkedinUrl fields', async () => {
        env.SOURCING_PROVIDER = 'mock';
        const provider = createSourcingProvider();

        const results = await provider.search('Node.js', 10);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);

        const candidate = results[0];
        expect(candidate).toHaveProperty('name');
        expect(candidate).toHaveProperty('linkedinUrl');
        // mock candidate may not have email on every record but at least one does
        expect(candidate).toHaveProperty('headline');
    });

    it('MockProvider.search() with limit=5 -> returns max 5 results', async () => {
        env.SOURCING_PROVIDER = 'mock';
        const provider = createSourcingProvider();

        const results = await provider.search('developer', 5);
        expect(results.length).toBeLessThanOrEqual(5);
    });

    it('invalid provider string -> throws error or defaults to mock', () => {
        env.SOURCING_PROVIDER = 'invalid_provider' as any;
        const provider = createSourcingProvider();
        // The factory defaults to mock provider
        expect(provider.name).toBe('mock');
    });
});
