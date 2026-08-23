import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';

const app = createApp();

async function register(name: string) {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            name,
            email: `${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`,
            password: 'Password123!',
            role: 'recruiter',
        });
    return {
        token: response.body.data.token as string,
        organizationId: response.body.data.user.defaultOrganizationId as string,
    };
}

describe('Hiring decisions and analytics', () => {
    it('records audited decisions and returns tenant-scoped analytics and CSV', async () => {
        const owner = await register('Analytics Owner');
        const outsider = await register('Analytics Outsider');
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'Data Engineer',
            description: 'Build data systems.',
            location: 'Remote',
            requirements: ['SQL'],
        });
        const candidate = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Nabila Rahman',
            linkedinUrl: 'https://linkedin.com/in/nabila-analytics',
            status: 'contacted',
            contactedAt: new Date(Date.now() - 3_600_000),
            respondedAt: new Date(),
            source: 'manual',
        });
        await Interview.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            candidateId: candidate._id,
            title: 'Screen',
            status: 'completed',
        });
        await Evaluation.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            candidateId: candidate._id,
            scorecardId: job._id,
            overallScore: 82,
            recommendation: 'yes',
            competencyScores: [],
            summary: 'Strong fit',
            source: 'fallback',
        });

        const decisionRes = await request(app)
            .post(`/api/jobs/${job._id}/decisions`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({
                candidateId: candidate._id.toString(),
                decision: 'shortlist',
                reason: 'Strong evidence',
            });
        expect(decisionRes.status).toBe(201);

        const outsiderList = await request(app)
            .get(`/api/jobs/${job._id}/decisions`)
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(outsiderList.status).toBe(404);

        const analyticsRes = await request(app)
            .get('/api/analytics')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(analyticsRes.status).toBe(200);
        expect(analyticsRes.body.data).toMatchObject({
            totals: { jobs: 1, candidates: 1, interviews: 1 },
            responseRate: 100,
            interviewCompletionRate: 100,
            averageScore: 82,
        });
        expect(analyticsRes.body.data.decisionCounts.shortlist).toBe(1);
        expect(analyticsRes.body.data.funnel).toMatchObject({
            contacted: 1,
            responded: 0,
            not_interested: 0,
        });
        expect(
            Object.values(analyticsRes.body.data.funnel).reduce(
                (total: number, count) => total + Number(count),
                0
            )
        ).toBe(analyticsRes.body.data.totals.candidates);

        const outsiderAnalytics = await request(app)
            .get('/api/analytics')
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(outsiderAnalytics.body.data.totals.candidates).toBe(0);

        const csvRes = await request(app)
            .get('/api/analytics.csv')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(csvRes.status).toBe(200);
        expect(csvRes.headers['content-type']).toContain('text/csv');
        expect(csvRes.text).toContain('average_score');
    });
});
