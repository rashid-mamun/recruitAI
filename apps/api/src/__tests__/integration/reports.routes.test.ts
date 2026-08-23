import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { CandidateReport } from '@/modules/reports/candidate-report.model';

const app = createApp();

describe('Candidate Reports Routes (Leadership Report Flow)', () => {
    let token: string;
    let organizationId: string;
    let jobId: string;
    let candidateId: string;
    let evaluationId: string;

    beforeEach(async () => {
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Report Tester',
                email: `report-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        token = authRes.body.data.token;
        organizationId = authRes.body.data.user.defaultOrganizationId;

        const job = await Job.create({
            organizationId,
            title: 'Engineering Manager',
            description: 'Lead engineering teams and deliver high-quality systems.',
            location: 'Remote',
            requirements: ['Leadership', 'Architecture', 'Communication'],
        });
        jobId = job._id.toString();

        const candidate = await Candidate.create({
            organizationId,
            jobId,
            name: 'Farhan Islam',
            linkedinUrl: 'https://linkedin.com/in/farhan-islam',
            headline: 'Engineering Manager',
            summary: 'Leads teams and owns architecture decisions.',
            skills: ['Leadership', 'Architecture', 'Communication'],
            experience: '9 years',
            location: 'Remote',
            source: 'manual',
            status: 'scored',
            score: {
                value: 91,
                reasoning: 'Excellent management and architecture fit.',
                strengths: ['Leadership', 'Architecture'],
                weaknesses: ['No recent hands-on coding evidence'],
                cachedAt: new Date(),
                source: 'ai',
            },
        });
        candidateId = candidate._id.toString();

        const evaluation = await Evaluation.create({
            organizationId,
            jobId,
            candidateId,
            scorecardId: job._id,
            overallScore: 88,
            recommendation: 'strong_yes',
            competencyScores: [
                {
                    competencyId: 'leadership',
                    name: 'Leadership',
                    score: 92,
                    weight: 40,
                    rationale: 'Strong leadership evidence.',
                    evidence: ['Led multiple teams.'],
                },
                {
                    competencyId: 'architecture',
                    name: 'Architecture',
                    score: 84,
                    weight: 35,
                    rationale: 'Good architecture ownership.',
                    evidence: ['Owned platform decisions.'],
                },
                {
                    competencyId: 'communication',
                    name: 'Communication',
                    score: 86,
                    weight: 25,
                    rationale: 'Clear communication.',
                    evidence: ['Explained tradeoffs clearly.'],
                },
            ],
            summary: 'Farhan is a strong leadership fit.',
            source: 'ai',
        });
        evaluationId = evaluation._id.toString();
    });

    it('generates, lists, reads, and downloads a candidate intelligence report', async () => {
        const generateRes = await request(app)
            .post(`/api/candidates/${candidateId}/reports`)
            .set('Authorization', `Bearer ${token}`);

        expect(generateRes.status).toBe(201);
        expect(generateRes.body.success).toBe(true);
        expect(generateRes.body.data).toMatchObject({
            candidateId,
            jobId,
            evaluationId,
            overallScore: 88,
            recommendation: 'strong_yes',
        });
        expect(generateRes.body.data.reportMarkdown).toContain('# Farhan Islam');
        expect(generateRes.body.data.reportMarkdown).toContain('| Leadership | 92 |');

        const reportId = generateRes.body.data._id;
        const savedReport = await CandidateReport.findById(reportId).lean();
        expect(savedReport?.title).toContain('Farhan Islam');

        const listRes = await request(app)
            .get(`/api/candidates/${candidateId}/reports`)
            .set('Authorization', `Bearer ${token}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data).toHaveLength(1);

        const getRes = await request(app)
            .get(`/api/reports/${reportId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.data.executiveSummary).toContain('88/100');

        const downloadRes = await request(app)
            .get(`/api/reports/${reportId}/download`)
            .set('Authorization', `Bearer ${token}`);

        expect(downloadRes.status).toBe(200);
        expect(downloadRes.headers['content-type']).toContain('text/markdown');
        expect(downloadRes.text).toContain('## Executive Summary');
        expect(downloadRes.text).toContain('Engineering Manager');

        const outsider = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Other Workspace',
                email: `other-report-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        const crossTenantRes = await request(app)
            .get(`/api/reports/${reportId}`)
            .set('Authorization', `Bearer ${outsider.body.data.token}`);
        expect(crossTenantRes.status).toBe(404);
    });

    it('rejects unauthenticated report access', async () => {
        const res = await request(app).get(`/api/candidates/${candidateId}/reports`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});
