import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';

const app = createApp();

async function account(name: string) {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            name,
            email: `${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`,
            password: 'Password123!',
            role: 'recruiter',
        });
    return {
        token: response.body.data.token,
        organizationId: response.body.data.user.defaultOrganizationId,
    };
}

describe('Global search', () => {
    it('searches protected workspace data without leaking another tenant', async () => {
        const owner = await account('Search Owner');
        const outsider = await account('Search Outsider');
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'Quantum Platform Engineer',
            description: 'Distributed platform work',
            location: 'Remote',
            requirements: ['Quantum queues'],
        });
        await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Searchable Candidate',
            linkedinUrl: 'https://linkedin.com/in/searchable-candidate',
            notes: 'Strong quantum architecture evidence',
            source: 'manual',
        });

        const result = await request(app)
            .get('/api/search?q=quantum')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(result.status).toBe(200);
        expect(result.body.data.jobs).toHaveLength(1);
        expect(result.body.data.candidates).toHaveLength(1);

        const isolated = await request(app)
            .get('/api/search?q=quantum')
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(isolated.status).toBe(200);
        expect(isolated.body.data.jobs).toHaveLength(0);
        expect(isolated.body.data.candidates).toHaveLength(0);
    });
});
